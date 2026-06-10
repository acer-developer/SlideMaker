"use strict";
/**
 * pptRenderer.js — SlideCanvas-matching PPTX renderer
 *
 * Accepts chart images (base64 PNG captured from Chart.js canvas) so the
 * downloaded PPTX looks EXACTLY like the in-app slide preview.
 *
 * Signature: renderPPT(PptxGenJS, spec, _chartDataArray, chartImages)
 *   - PptxGenJS       : constructor (injected for edge compat)
 *   - spec            : { layout, slideTitle, slideSubtitle, exhibits[], takeaways[] }
 *   - _chartDataArray : unused (kept for back-compat)
 *   - chartImages     : string[] — base64 PNG data URLs captured from SlideCanvas
 */
module.exports = { renderPPT };

/* ── Brand colours (no # prefix — pptxgenjs format) ──────────────────────── */
const B = {
  primary : "3AA4A9",
  dark1   : "2E8388",
  dark2   : "236567",
  dark3   : "1A4A4C",
  light3  : "91DFE2",
  light4  : "B5EEEF",
  white   : "FFFFFF",
  bg      : "FAFEFE",
  muted   : "5C7C7E",
};

/* ── Unit helper (96 dpi → inches) ──────────────────────────────────────── */
const px = n => +(n / 96).toFixed(4);

/* ── Slide dimensions (A4 portrait) ─────────────────────────────────────── */
const W = 8.27;
const H = 11.69;

/* ── Layout constants matching SlideCanvas.tsx ───────────────────────────── */
const HDR_H        = px(70);
const PAD          = px(20);
const KPI_W        = px(190);
const H_GAP        = px(10);
const ANN_H        = px(80);
const STACK_GAP    = px(10);
const TITLE_ROW_H  = px(30);
const SOURCE_H     = px(16);
const GRID_GAP     = px(14);
const GRID_TITLE_H = px(26);
const INSPAD       = px(10);
const INS_ROW_H    = px(14);
const BOTTOM_STRIP = px(3);
const MAX_SINGLE   = px(680);
const FONT         = "Aptos";

/* ══════════════════════════════════════════════════════════════════════════ */
async function renderPPT(PptxGenJS, spec, _chartDataArray, chartImages = []) {
  const pres = new PptxGenJS();
  pres.defineLayout({ name: "A4P", width: W, height: H });
  pres.layout = "A4P";

  const { slideTitle, slideSubtitle, exhibits = [], takeaways = [] } = spec;
  const count = Math.min(exhibits.length, 4);
  const slide = pres.addSlide();

  /* Compute takeaway height */
  const tkwRows = Math.min(takeaways.length, 4);
  const hasTkw  = tkwRows > 0;
  const TKW_H   = hasTkw
    ? INSPAD * 2 + px(22) + tkwRows * (INS_ROW_H + px(5)) + px(8)
    : 0;

  /* White background */
  slide.addShape(pres.ShapeType.rect, { x:0, y:0, w:W, h:H, fill:{color:B.white}, line:{width:0} });

  /* Header */
  addHeader(slide, pres, slideTitle, slideSubtitle);

  /* Bottom teal strip */
  slide.addShape(pres.ShapeType.rect, {
    x:0, y:H - BOTTOM_STRIP, w:W, h:BOTTOM_STRIP,
    fill:{color:B.primary}, line:{width:0},
  });

  /* Content geometry */
  const availH   = H - HDR_H - TKW_H - BOTTOM_STRIP - PAD;
  const availW   = W - PAD * 2;
  const contentY = HDR_H + PAD;

  /* Render exhibits */
  if (count <= 2) {
    const exhibitH = count === 1
      ? Math.min(availH, MAX_SINGLE)
      : (availH - STACK_GAP) / 2;

    for (let i = 0; i < count; i++) {
      const ey = contentY + i * (exhibitH + (count === 2 ? STACK_GAP : 0));
      renderExhibitWithKPI(slide, pres, exhibits[i], chartImages[i] || null,
        PAD, ey, availW, exhibitH);
    }
  } else {
    const cellW = (availW - GRID_GAP) / 2;
    const cellH = (availH - GRID_GAP) / 2;

    for (let i = 0; i < count; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      let cx = PAD + col * (cellW + GRID_GAP);
      if (count === 3 && i === 2) cx = PAD + (availW - cellW) / 2;
      const cy = contentY + row * (cellH + GRID_GAP);
      renderExhibitCard(slide, pres, exhibits[i], chartImages[i] || null, cx, cy, cellW, cellH);
    }
  }

  /* Takeaways */
  if (hasTkw) {
    renderTakeaways(slide, pres, takeaways.slice(0, 4), H - TKW_H - BOTTOM_STRIP);
  }

  return pres.write({ outputType: "nodebuffer" });
}

/* ─── Header ────────────────────────────────────────────────────────────── */
function addHeader(slide, pres, title, subtitle) {
  slide.addShape(pres.ShapeType.rect, { x:0, y:0, w:W, h:HDR_H, fill:{color:B.white}, line:{width:0} });
  slide.addText((title || "DATA ANALYSIS").toUpperCase(), {
    x: PAD, y: px(15), w: W - PAD*2, h: px(22),
    fontFace: FONT, fontSize: 13, bold: true, color: B.dark3, charSpacing: 0.5,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: PAD, y: px(40), w: (W - PAD*2) * 0.88, h: px(18),
      fontFace: FONT, fontSize: 7, color: B.muted, wrap: true,
    });
  }
  /* 3px teal border at bottom of header */
  slide.addShape(pres.ShapeType.rect, {
    x:0, y: HDR_H - px(3), w:W, h:px(3),
    fill:{color:B.primary}, line:{width:0},
  });
}

/* ─── Exhibit with KPI panel (1–2 chart layout) ──────────────────────────── */
function renderExhibitWithKPI(slide, pres, ex, chartImage, x, y, availW, h) {
  if (!ex) return;
  const chartCardW = availW - KPI_W - H_GAP;
  const hasAnns    = (ex.annotations || []).length > 0;
  const hasSrc     = !!ex.source;
  const annH       = hasAnns ? ANN_H : 0;
  const srcH       = hasSrc  ? SOURCE_H : 0;
  const chartBodyH = h - TITLE_ROW_H - annH - srcH;

  /* Chart card shadow + border */
  slide.addShape(pres.ShapeType.rect, {
    x, y, w: chartCardW, h,
    fill:{color:B.white}, line:{color:B.light4, width:0.75},
    shadow:{type:"outer", blur:4, offset:2, angle:270, color:"000000", opacity:0.08},
  });

  addExhibitTitleRow(slide, pres, ex, x, y, chartCardW, TITLE_ROW_H);

  const chartBodyY = y + TITLE_ROW_H;
  slide.addShape(pres.ShapeType.rect, {
    x, y: chartBodyY, w: chartCardW, h: chartBodyH,
    fill:{color:B.bg}, line:{width:0},
  });

  if (chartImage) {
    const ip = px(8);
    slide.addImage({
      data: chartImage,
      x: x + ip, y: chartBodyY + ip,
      w: chartCardW - ip*2, h: chartBodyH - ip*2,
      sizing: { type:"contain", w: chartCardW - ip*2, h: chartBodyH - ip*2 },
    });
  }

  if (hasAnns) renderAnnotations(slide, pres, ex.annotations, x, chartBodyY + chartBodyH, chartCardW);

  if (hasSrc) {
    const srcY = chartBodyY + chartBodyH + annH;
    slide.addShape(pres.ShapeType.rect, { x, y:srcY, w:chartCardW, h:srcH, fill:{color:B.bg}, line:{color:B.light4, width:0.5} });
    slide.addText(`Source: ${ex.source}`, {
      x: x+px(8), y: srcY+px(4), w: chartCardW-px(16), h: srcH-px(4),
      fontFace:FONT, fontSize:5.5, italic:true, color:"8AABAC",
    });
  }

  /* KPI panel */
  renderKPIPanel(slide, pres, ex.kpi || ex, x + chartCardW + H_GAP, y, KPI_W, h);
}

/* ─── KPI Panel ──────────────────────────────────────────────────────────── */
function renderKPIPanel(slide, pres, kpi, x, y, w, h) {
  if (!kpi) return;

  slide.addShape(pres.ShapeType.rect, {
    x, y, w, h,
    fill:{color:"F5FBFC"}, line:{color:B.light3, width:1},
    shadow:{type:"outer", blur:4, offset:2, angle:270, color:"000000", opacity:0.08},
  });

  /* Emoji circle */
  const cs = px(64);
  const cx = x + (w - cs) / 2;
  const cy = y + px(18);
  slide.addShape(pres.ShapeType.ellipse, { x:cx, y:cy, w:cs, h:cs, fill:{color:B.primary}, line:{color:B.light4, width:1.5} });
  const icon = String(kpi.icon || kpi.kpiIcon || "📊").slice(0, 2);
  slide.addText(icon, {
    x:cx, y:cy + px(14), w:cs, h:cs - px(14),
    fontFace:FONT, fontSize:20, align:"center",
  });

  let curY = cy + cs + px(8);
  const tw = w - px(20);
  const tx = x + px(10);

  /* Title */
  slide.addText((kpi.title || kpi.kpiTitle || "Key Insight").toUpperCase(), {
    x:tx, y:curY, w:tw, h:px(22),
    fontFace:FONT, fontSize:7.5, bold:true, color:B.dark3,
    align:"center", charSpacing:0.5, wrap:true,
  });
  curY += px(26);

  /* Divider */
  slide.addShape(pres.ShapeType.rect, { x:tx, y:curY, w:tw, h:px(1.5), fill:{color:B.light3}, line:{width:0} });
  curY += px(8);

  /* Key metric — teal */
  const metric = kpi.keyMetric || kpi.kpiSubtitle || "";
  if (metric) {
    slide.addText(metric, {
      x:tx, y:curY, w:tw, h:px(30),
      fontFace:FONT, fontSize:6.5, bold:true, color:B.primary, align:"center", wrap:true,
    });
    curY += px(34);
  }

  /* Description */
  const desc = kpi.description || kpi.kpiDescription || "";
  if (desc) {
    slide.addText(desc, {
      x:tx, y:curY, w:tw, h: h - (curY - y) - px(10),
      fontFace:FONT, fontSize:6.5, color:B.dark2, wrap:true, valign:"top",
    });
  }
}

/* ─── Period Annotations ─────────────────────────────────────────────────── */
function renderAnnotations(slide, pres, annotations, x, y, w) {
  if (!annotations || !annotations.length) return;
  const cols = Math.min(annotations.length, 3);
  const colW = w / cols;

  slide.addShape(pres.ShapeType.rect, {
    x, y, w, h:ANN_H,
    fill:{color:"F5FAFB"}, line:{color:B.light4, width:0.75},
  });

  annotations.slice(0, 3).forEach((ann, i) => {
    const cx = x + i * colW;
    if (i > 0) {
      slide.addShape(pres.ShapeType.line, {
        x:cx, y:y+px(5), w:0, h:ANN_H-px(10),
        line:{color:B.light3, width:0.75, dashType:"dash"},
      });
    }
    if (ann.period) {
      slide.addText(ann.period, {
        x:cx+px(4), y:y+px(5), w:colW-px(8), h:px(10),
        fontFace:FONT, fontSize:5, bold:true, color:B.dark2, align:"center", charSpacing:0.5,
      });
    }
    if (ann.icon) {
      slide.addText(String(ann.icon).slice(0,2), {
        x:cx+px(4), y:y+px(16), w:colW-px(8), h:px(14),
        fontFace:FONT, fontSize:11, align:"center",
      });
    }
    if (ann.label) {
      slide.addText(ann.label, {
        x:cx+px(4), y:y+px(32), w:colW-px(8), h:px(12),
        fontFace:FONT, fontSize:6.5, bold:true, color:B.dark3,
      });
    }
    if (ann.description) {
      slide.addText(ann.description, {
        x:cx+px(4), y:y+px(46), w:colW-px(8), h:ANN_H-px(50),
        fontFace:FONT, fontSize:6, color:B.dark1, wrap:true,
      });
    }
  });
}

/* ─── Exhibit Card (3–4 grid layout) ────────────────────────────────────── */
function renderExhibitCard(slide, pres, ex, chartImage, x, y, w, h) {
  if (!ex) return;
  const insCount   = Math.min((ex.insights || []).length, 2);
  const insSectH   = insCount > 0
    ? INSPAD*2 + insCount*(INS_ROW_H + px(3)) + px(4)
    : 0;
  const chartBodyH = h - GRID_TITLE_H - insSectH;

  slide.addShape(pres.ShapeType.rect, {
    x, y, w, h,
    fill:{color:B.white}, line:{color:B.light4, width:0.75},
    shadow:{type:"outer", blur:3, offset:1, angle:270, color:"000000", opacity:0.07},
  });

  addExhibitTitleRow(slide, pres, ex, x, y, w, GRID_TITLE_H);

  const chartBodyY = y + GRID_TITLE_H;
  slide.addShape(pres.ShapeType.rect, { x, y:chartBodyY, w, h:chartBodyH, fill:{color:B.bg}, line:{width:0} });

  if (chartImage) {
    const ip = px(6);
    slide.addImage({
      data: chartImage,
      x: x+ip, y: chartBodyY+ip,
      w: w-ip*2, h: chartBodyH-ip*2,
      sizing:{type:"contain", w:w-ip*2, h:chartBodyH-ip*2},
    });
  }

  if (insCount > 0) {
    const insY = chartBodyY + chartBodyH;
    slide.addShape(pres.ShapeType.rect, { x, y:insY, w, h:insSectH, fill:{color:"EFF9F9"}, line:{color:B.light3, width:0.75} });
    ex.insights.slice(0, 2).forEach((ins, i) => {
      const clean = String(ins).replace(/\[\[(.+?)\]\]/g, "$1");
      slide.addText(`• ${clean}`, {
        x:x+INSPAD, y:insY+INSPAD+i*(INS_ROW_H+px(3)),
        w:w-INSPAD*2, h:INS_ROW_H,
        fontFace:FONT, fontSize:6.5, color:B.dark3,
      });
    });
  }
}

/* ─── Shared: exhibit title row (teal badge + dark bar) ──────────────────── */
function addExhibitTitleRow(slide, pres, ex, x, y, totalW, rowH) {
  const badgeW = px(65);
  slide.addShape(pres.ShapeType.rect, { x, y, w:badgeW, h:rowH, fill:{color:B.primary}, line:{width:0} });
  slide.addText(`Exhibit ${ex.exhibitNum || 1}`, {
    x:x+px(5), y:y+px(8), w:badgeW-px(8), h:rowH-px(12),
    fontFace:FONT, fontSize:5.5, bold:true, color:B.white, align:"center", charSpacing:0.5,
  });
  slide.addShape(pres.ShapeType.rect, { x:x+badgeW, y, w:totalW-badgeW, h:rowH, fill:{color:B.dark3}, line:{width:0} });
  slide.addShape(pres.ShapeType.rect, {
    x:x+badgeW, y:y+rowH-px(2), w:totalW-badgeW, h:px(2),
    fill:{color:B.primary}, line:{width:0},
  });
  slide.addText((ex.title || "").slice(0, 80), {
    x:x+badgeW+px(8), y:y+px(9), w:totalW-badgeW-px(14), h:rowH-px(12),
    fontFace:FONT, fontSize:7, bold:true, color:B.white,
  });
}

/* ─── Key Takeaways ─────────────────────────────────────────────────────── */
function renderTakeaways(slide, pres, insights, y) {
  const rows = insights.length;
  const h    = INSPAD*2 + px(22) + rows*(INS_ROW_H + px(5)) + px(8);

  slide.addShape(pres.ShapeType.rect, { x:0, y, w:W, h, fill:{color:"EAF6F7"}, line:{width:0} });
  slide.addShape(pres.ShapeType.rect, { x:0, y, w:W, h:px(2.5), fill:{color:B.primary}, line:{width:0} });

  let curY = y + INSPAD;
  slide.addShape(pres.ShapeType.rect, { x:PAD, y:curY+px(3), w:px(3), h:px(14), fill:{color:B.primary}, line:{width:0} });
  slide.addText("KEY TAKEAWAYS", {
    x:PAD+px(10), y:curY, w:W-PAD*2, h:px(20),
    fontFace:FONT, fontSize:7.5, bold:true, color:B.dark3, charSpacing:1.5,
  });
  curY += px(22) + px(6);

  insights.forEach(ins => {
    slide.addShape(pres.ShapeType.ellipse, { x:PAD, y:curY+px(1), w:px(14), h:px(14), fill:{color:B.primary}, line:{width:0} });
    slide.addText("✓", {
      x:PAD, y:curY+px(1), w:px(14), h:px(14),
      fontFace:FONT, fontSize:6, bold:true, color:B.white, align:"center", valign:"middle",
    });
    const clean = String(ins).replace(/\[\[(.+?)\]\]/g, "$1");
    slide.addText(clean, {
      x:PAD+px(20), y:curY, w:W-PAD*2-px(20), h:INS_ROW_H,
      fontFace:FONT, fontSize:7.5, color:B.dark3,
    });
    curY += INS_ROW_H + px(5);
  });
}
