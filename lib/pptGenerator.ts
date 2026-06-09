import type { ChartBlock } from "./types";

export async function generatePPT(blocks: ChartBlock[]): Promise<void> {
  const pptxgenjs = (await import("pptxgenjs")).default;
  const pres = new pptxgenjs();

  // A4 portrait in inches (8.27 × 11.69)
  pres.defineLayout({ name: "A4", width: 8.27, height: 11.69 });
  pres.layout = "A4";

  const slide = pres.addSlide();

  // Header bar
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 8.27, h: 0.62,
    fill: { color: "1A4A4C" },
  });

  // Brand accent line
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0.62, w: 8.27, h: 0.04,
    fill: { color: "3AA4A9" },
  });

  // Header title
  slide.addText("Research Report", {
    x: 0.3, y: 0.1, w: 5, h: 0.25,
    fontSize: 12, bold: true, color: "FFFFFF",
    fontFace: "Calibri",
  });
  slide.addText("Data Analysis & Insights", {
    x: 0.3, y: 0.35, w: 5, h: 0.2,
    fontSize: 9, color: "91DFE2",
    fontFace: "Calibri",
  });

  // Chart count badge
  slide.addText(`${blocks.length} Chart${blocks.length !== 1 ? "s" : ""}`, {
    x: 6.9, y: 0.15, w: 1.1, h: 0.28,
    fontSize: 9, bold: true, color: "FFFFFF",
    fill: { color: "3AA4A9" },
    align: "center",
    fontFace: "Calibri",
  });

  // Footer
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 11.34, w: 8.27, h: 0.35,
    fill: { color: "D5F6F7" },
    line: { color: "91DFE2", width: 0.5 },
  });
  slide.addText("Chart Deck", {
    x: 0.3, y: 11.37, w: 2, h: 0.25,
    fontSize: 8, color: "236567", bold: true, fontFace: "Calibri",
  });
  slide.addText("Confidential", {
    x: 6.5, y: 11.37, w: 1.5, h: 0.25,
    fontSize: 8, color: "2E8388", align: "right", fontFace: "Calibri",
  });

  // Layout grid
  const count = Math.min(blocks.length, 4);
  const cols = count <= 1 ? 1 : 2;
  const rows = count <= 2 ? 1 : 2;

  const PAD = 0.25;
  const GAP = 0.14;
  const HEADER_H = 0.7;
  const FOOTER_H = 0.4;

  const availW = 8.27 - PAD * 2;
  const availH = 11.69 - HEADER_H - FOOTER_H - PAD * 2;
  const cellW = (availW - (cols - 1) * GAP) / cols;
  const cellH = (availH - (rows - 1) * GAP) / rows;

  const chartColors = ["3AA4A9", "52B5BA", "6EC7CB", "2E8388", "91DFE2", "236567"];

  blocks.slice(0, 4).forEach((block, idx) => {
    let col = idx % cols;
    let row = Math.floor(idx / cols);

    // Special centering for 3rd chart when count=3
    let xOffset = 0;
    if (count === 3 && idx === 2) {
      col = 0;
      row = 1;
      xOffset = cellW / 2 + GAP / 2;
    }

    const x = PAD + col * (cellW + GAP) + xOffset;
    const y = HEADER_H + PAD + row * (cellH + GAP);
    const TITLE_H = 0.3;
    const INSIGHT_H = Math.min(cellH * 0.35, 1.1);
    const chartH = cellH - TITLE_H - INSIGHT_H;

    // Chart container background
    slide.addShape(pres.ShapeType.rect, {
      x, y, w: cellW, h: cellH,
      fill: { color: "FFFFFF" },
      line: { color: "91DFE2", width: 0.5 },
    });

    // Title bar
    slide.addShape(pres.ShapeType.rect, {
      x, y, w: cellW, h: TITLE_H,
      fill: { color: "1A4A4C" },
    });

    const titleText = block.context || `Chart ${idx + 1}`;
    slide.addText(titleText.length > 55 ? titleText.slice(0, 55) + "…" : titleText, {
      x: x + 0.08, y: y + 0.05, w: cellW - 0.2, h: TITLE_H - 0.08,
      fontSize: 7.5, bold: true, color: "FFFFFF", fontFace: "Calibri",
      wrap: false,
    });

    // Chart placeholder area (fake bars)
    slide.addShape(pres.ShapeType.rect, {
      x, y: y + TITLE_H, w: cellW, h: chartH,
      fill: { color: "F4FAFA" },
    });

    // Simple bar chart visual using shapes
    const barData = [0.55, 0.80, 0.65, 0.90, 0.72, 0.60, 0.85];
    const barAreaW = cellW * 0.85;
    const barAreaH = chartH * 0.72;
    const barAreaX = x + (cellW - barAreaW) / 2;
    const barAreaY = y + TITLE_H + chartH * 0.12 + barAreaH;
    const barW = barAreaW / (barData.length * 1.5);
    const barGap = (barAreaW - barW * barData.length) / (barData.length - 1);

    barData.forEach((h, bi) => {
      const bH = h * barAreaH;
      const bX = barAreaX + bi * (barW + barGap);
      const bY = barAreaY - bH;
      slide.addShape(pres.ShapeType.rect, {
        x: bX, y: bY, w: barW, h: bH,
        fill: { color: chartColors[bi % chartColors.length] },
        line: { color: "FFFFFF", width: 0.3 },
      });
    });

    // Baseline
    slide.addShape(pres.ShapeType.line, {
      x: barAreaX, y: barAreaY, w: barAreaW, h: 0,
      line: { color: "91DFE2", width: 0.5 },
    });

    // Insights section
    const insightY = y + TITLE_H + chartH;
    slide.addShape(pres.ShapeType.rect, {
      x, y: insightY, w: cellW, h: INSIGHT_H,
      fill: { color: "D5F6F7" },
      line: { color: "91DFE2", width: 0.3 },
    });

    slide.addText("Key Insights", {
      x: x + 0.08, y: insightY + 0.04, w: cellW - 0.16, h: 0.14,
      fontSize: 6.5, bold: true, color: "236567", fontFace: "Calibri",
    });

    const insights = block.insights.length > 0
      ? block.insights
      : ["Add context and generate insights to see them here."];

    insights.slice(0, 3).forEach((ins, ii) => {
      const insY = insightY + 0.18 + ii * 0.26;
      if (insY + 0.22 > y + cellH - 0.04) return;
      slide.addText(`• ${ins.length > 80 ? ins.slice(0, 80) + "…" : ins}`, {
        x: x + 0.08, y: insY, w: cellW - 0.16, h: 0.22,
        fontSize: 6, color: "1A4A4C", fontFace: "Calibri",
        wrap: true,
      });
    });
  });

  await pres.writeFile({ fileName: "slidemaker-slide.pptx" });
}
