/**
 * pptRenderer.js
 * Renders an AI-generated slide spec into a real editable PPTX (pptxgenjs).
 * All positions are layout-template-driven; AI supplies content + design decisions.
 */

// px → inches (A4: 794 px = 8.27 in at 96 dpi)
const I = (px) => +(px * (8.27 / 794)).toFixed(4);

// ── Layout constants (pixels) ────────────────────────────────────────────────
const A4_W_PX     = 794;
const A4_H_PX     = 1123;
const HDR_H       = 70;
const PAD         = 20;
const STACK_GAP   = 12;
const H_GAP       = 10;
const KPI_W       = 190;
const TITLE_ROW_H = 30;
const ANN_H       = 80;
const SOURCE_H    = 16;
const GAP         = 14;
const GRID_TITLE_H = 26;
const INSPAD      = 10;
const INS_ROW_H   = 16;
const MAX_SINGLE_H = 680;

// ── Brand colours (hex, no #) ────────────────────────────────────────────────
const C = {
  dark3:   '1A4A4C',
  dark2:   '236567',
  dark1:   '2E8388',
  primary: '3AA4A9',
  light3:  '91DFE2',
  light4:  'B5EEEF',
  light5:  'D5F6F7',
  white:   'FFFFFF',
  bg:      'FAFEFE',
  kpiBg:   'F5FBFC',
  tkwBg:   'EAF6F7',
};

// ── Header ───────────────────────────────────────────────────────────────────
function addHeader(slide, pres, title, subtitle) {
  // 3-px teal border at bottom of header zone
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: I(HDR_H - 3), w: 8.27, h: I(3),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText((title || 'DATA ANALYSIS REPORT').toUpperCase(), {
    x: I(PAD), y: I(13), w: I(A4_W_PX - PAD * 2), h: I(26),
    fontSize: 11, bold: true, color: C.dark3, fontFace: 'Calibri',
    charSpacing: 0.8, valign: 'middle',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: I(PAD), y: I(43), w: I(A4_W_PX - PAD * 2 - 60), h: I(20),
      fontSize: 6, color: '5C7C7E', fontFace: 'Calibri', wrap: true, valign: 'top',
    });
  }
}

// ── Bottom accent line ───────────────────────────────────────────────────────
function addBottomAccent(slide, pres) {
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: I(A4_H_PX - 3), w: 8.27, h: I(3),
    fill: { color: C.primary }, line: { color: C.primary },
  });
}

// ── Format a number value for KPI display ────────────────────────────────────
function formatVal(n) {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1);
}

// ── Map chartType string to pptxgenjs chart type + options ───────────────────
function resolveChartType(pres, chartType) {
  switch (chartType) {
    case 'bar-horizontal':
      return { type: pres.ChartType.bar, extra: { barDir: 'bar' } };
    case 'stacked-bar':
      return { type: pres.ChartType.bar, extra: { barDir: 'col', barGrouping: 'stacked' } };
    case 'line':
    case 'multi-line':
      return { type: pres.ChartType.line, extra: {} };
    case 'area':
      return { type: pres.ChartType.area, extra: {} };
    case 'pie':
      return { type: pres.ChartType.pie, extra: {} };
    case 'donut':
      return { type: pres.ChartType.doughnut, extra: {} };
    case 'scatter':
      return { type: pres.ChartType.scatter, extra: {} };
    case 'bar-vertical':
    case 'grouped-bar':
    default:
      return { type: pres.ChartType.bar, extra: { barDir: 'col' } };
  }
}

// ── Render a native pptxgenjs chart (or KPI text / placeholder) ──────────────
function addNativeChart(slide, pres, chartData, x, y, w, h) {
  const parsed    = (chartData && chartData.parsed) || { labels: [], series: [] };
  const chartType = (chartData && chartData.chartType) || null;

  // Empty data → placeholder
  if (!parsed.labels || parsed.labels.length === 0 || !parsed.series || parsed.series.length === 0) {
    slide.addText('No chart data', {
      x: I(x), y: I(y + h / 2 - 10),
      w: I(w), h: I(20),
      fontSize: 9, color: '8AABAC', fontFace: 'Calibri',
      align: 'center', valign: 'middle',
    });
    return;
  }

  const { labels, series } = parsed;

  // KPI special case
  if (chartType === 'kpi') {
    const val = series[0]?.values[0] ?? (series[0]?.values.reduce((a, b) => a + b, 0) ?? 0);
    slide.addText(formatVal(val), {
      x: I(x), y: I(y + h / 2 - 20),
      w: I(w), h: I(40),
      fontSize: 32, bold: true, color: '1A4A4C', fontFace: 'Calibri',
      align: 'center', valign: 'middle',
    });
    slide.addText(series[0]?.name || '', {
      x: I(x), y: I(y + h / 2 + 20),
      w: I(w), h: I(16),
      fontSize: 9, color: '3AA4A9', fontFace: 'Calibri', align: 'center',
    });
    return;
  }

  const { type, extra } = resolveChartType(pres, chartType);
  const isPielike = (chartType === 'pie' || chartType === 'donut');
  const isMultiSeries = series.length > 1;

  const chartDataArr = series.map(s => ({
    name: s.name,
    labels: labels,
    values: s.values,
  }));

  const opts = {
    x: I(x), y: I(y),
    w: I(w), h: I(h),
    chartColors: ['3AA4A9', '2E8388', '52B5BA', '6EC7CB', '91DFE2'],
    lineSize: 2,
    lineSmooth: false,
    // Axes
    showValAxis: !isPielike,
    showCatAxis: !isPielike,
    valAxisFontSize: 7,
    catAxisFontSize: 7,
    valAxisFontColor: '5C7C7E',
    catAxisFontColor: '5C7C7E',
    valGridLine: { style: 'solid', color: 'EEF7F8', size: 0.5 },
    catGridLine: { style: 'none' },
    // Data labels
    showValue: !isPielike,
    dataLabelFontSize: 7,
    dataLabelColor: '236567',
    dataLabelPosition: 'outEnd',
    // Legend
    showLegend: isPielike ? true : isMultiSeries,
    legendFontSize: 7,
    legendColor: '1A4A4C',
    legendPos: 'b',
    // Border
    plotAreaBorderColor: 'FFFFFF',
    ...extra,
  };

  if (isPielike) {
    opts.showLeaderLines = true;
    opts.showValue = false;
  }

  slide.addChart(type, chartDataArr, opts);
}

// ── Exhibit card with KPI panel (layouts: single, stacked-2) ─────────────────
function addExhibitWithKPI(slide, pres, exhibit, x, y, availW, exhibitH, chartData) {
  const chartCardW = availW - KPI_W - H_GAP;
  const kpiX       = x + chartCardW + H_GAP;
  const hasAnns    = Array.isArray(exhibit.annotations) && exhibit.annotations.length > 0;
  const hasSrc     = !!exhibit.source;
  const annH       = hasAnns ? ANN_H : 0;
  const srcH       = hasSrc  ? SOURCE_H : 0;
  const chartBodyH = exhibitH - TITLE_ROW_H - annH - srcH;

  addChartCard(slide, pres, exhibit, x, y, chartCardW, exhibitH, chartBodyH, annH, srcH, chartData);
  addKPIPanel(slide, pres, exhibit, kpiX, y, KPI_W, exhibitH);
}

// ── Chart card ───────────────────────────────────────────────────────────────
function addChartCard(slide, pres, exhibit, x, y, cardW, cardH, chartBodyH, annH, srcH, chartData) {
  const title   = truncate(exhibit.title || `Chart ${exhibit.exhibitNum || 1}`, 72);
  const BADGE_W = 66;

  // Card background
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(cardW), h: I(cardH),
    fill: { color: C.white }, line: { color: C.light4, width: 0.5 },
  });

  // Teal badge section
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(BADGE_W), h: I(TITLE_ROW_H),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + 7), y: I(y + 8), w: I(52), h: I(TITLE_ROW_H - 16),
    fill: { color: C.white }, line: { color: C.white },
  });
  slide.addText(`EXHIBIT ${exhibit.exhibitNum || 1}`, {
    x: I(x + 7), y: I(y + 8), w: I(52), h: I(TITLE_ROW_H - 16),
    fontSize: 5, bold: true, color: C.dark3, fontFace: 'Calibri',
    align: 'center', valign: 'middle',
  });

  // Dark title section
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + BADGE_W), y: I(y), w: I(cardW - BADGE_W), h: I(TITLE_ROW_H),
    fill: { color: C.dark3 }, line: { color: C.dark3 },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + BADGE_W), y: I(y + TITLE_ROW_H - 2), w: I(cardW - BADGE_W), h: I(2),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText(title, {
    x: I(x + BADGE_W + 8), y: I(y + 5), w: I(cardW - BADGE_W - 16), h: I(TITLE_ROW_H - 8),
    fontSize: 7, bold: true, color: C.white, fontFace: 'Calibri', valign: 'middle',
  });

  // Chart body background
  const imgY = y + TITLE_ROW_H;
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(imgY), w: I(cardW), h: I(chartBodyH),
    fill: { color: C.bg }, line: { color: C.bg },
  });
  addNativeChart(slide, pres, chartData, x + 8, imgY + 6, cardW - 16, chartBodyH - 10);

  // Period annotations
  if (annH > 0 && exhibit.annotations && exhibit.annotations.length > 0) {
    addAnnotations(slide, pres, exhibit.annotations, x, imgY + chartBodyH, cardW, annH);
  }

  // Source attribution
  if (srcH > 0 && exhibit.source) {
    const srcY = imgY + chartBodyH + annH;
    slide.addShape(pres.ShapeType.rect, {
      x: I(x), y: I(srcY), w: I(cardW), h: I(srcH),
      fill: { color: C.bg }, line: { color: C.light4, width: 0.3 },
    });
    slide.addText(`Source: ${exhibit.source}`, {
      x: I(x + 10), y: I(srcY + 3), w: I(cardW - 20), h: I(srcH - 4),
      fontSize: 5, italic: true, color: '8AABAC', fontFace: 'Calibri', valign: 'middle',
    });
  }
}

// ── Period annotations row ────────────────────────────────────────────────────
function addAnnotations(slide, pres, annotations, x, annY, cardW, annH) {
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(annY), w: I(cardW), h: I(annH),
    fill: { color: 'F5FAFB' }, line: { color: C.light4, width: 0.3 },
  });

  const colW = Math.floor(cardW / 3);

  annotations.slice(0, 3).forEach((ann, i) => {
    const aX   = x + i * colW;
    const midX = aX + colW / 2;
    const pW   = 32; // period label width

    // Column divider
    if (i > 0) {
      slide.addShape(pres.ShapeType.line, {
        x: I(aX), y: I(annY + 5), w: 0, h: I(annH - 10),
        line: { color: C.light3, pt: 0.5, dashType: 'dash' },
      });
    }
    // Left dashed line
    const leftW = Math.max(0, midX - aX - 8 - pW / 2 - 4);
    if (leftW > 0) {
      slide.addShape(pres.ShapeType.line, {
        x: I(aX + 8), y: I(annY + 12), w: I(leftW), h: 0,
        line: { color: C.light3, pt: 0.6, dashType: 'dash' },
      });
    }
    // Right dashed line
    const rightStart = midX + pW / 2 + 4;
    const rightW = Math.max(0, aX + colW - 8 - rightStart);
    if (rightW > 0) {
      slide.addShape(pres.ShapeType.line, {
        x: I(rightStart), y: I(annY + 12), w: I(rightW), h: 0,
        line: { color: C.light3, pt: 0.6, dashType: 'dash' },
      });
    }
    // Arrows
    slide.addText('◄', {
      x: I(aX + 4), y: I(annY + 7), w: I(8), h: I(10),
      fontSize: 4.5, color: C.dark1, fontFace: 'Calibri', align: 'center',
    });
    slide.addText('►', {
      x: I(aX + colW - 12), y: I(annY + 7), w: I(8), h: I(10),
      fontSize: 4.5, color: C.dark1, fontFace: 'Calibri', align: 'center',
    });
    // Period label
    slide.addText((ann.period || '').toUpperCase(), {
      x: I(midX - pW / 2), y: I(annY + 5), w: I(pW), h: I(12),
      fontSize: 5, bold: true, color: C.dark2, fontFace: 'Calibri',
      align: 'center', charSpacing: 0.3,
    });
    // Phase icon
    const iconOffset = ann.icon ? 18 : 0;
    if (ann.icon) {
      slide.addText(ann.icon, {
        x: I(aX + colW / 2 - 8), y: I(annY + 18), w: I(16), h: I(16),
        fontSize: 9, fontFace: 'Segoe UI Emoji', align: 'center',
      });
    }
    // Phase label
    slide.addText(ann.label || '', {
      x: I(aX + 6), y: I(annY + 22 + iconOffset), w: I(colW - 12), h: I(11),
      fontSize: 6, bold: true, color: C.dark3, fontFace: 'Calibri',
    });
    // Description
    const descY = annY + 34 + iconOffset;
    const descH = Math.max(4, annH - (descY - annY) - 4);
    slide.addText(ann.description || '', {
      x: I(aX + 6), y: I(descY), w: I(colW - 12), h: I(descH),
      fontSize: 5.5, color: C.dark1, fontFace: 'Calibri', wrap: true, valign: 'top',
    });
  });
}

// ── KPI panel ────────────────────────────────────────────────────────────────
function addKPIPanel(slide, pres, exhibit, x, y, kpiW, kpiH) {
  const kpi = exhibit.kpi || {};

  // Panel background
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(kpiW), h: I(kpiH),
    fill: { color: C.kpiBg }, line: { color: C.light3, width: 0.8 },
  });

  // Circular icon
  const circR = 30;
  const circX = x + kpiW / 2 - circR;
  const circY = y + 16;
  slide.addShape(pres.ShapeType.ellipse, {
    x: I(circX), y: I(circY), w: I(circR * 2), h: I(circR * 2),
    fill: { color: C.primary }, line: { color: C.light4, width: 1.5 },
  });
  // Inner ring (decorative)
  slide.addShape(pres.ShapeType.ellipse, {
    x: I(circX + 8), y: I(circY + 8), w: I((circR - 8) * 2), h: I((circR - 8) * 2),
    fill: { type: 'none' }, line: { color: C.light3, width: 0.8 },
  });
  slide.addText(kpi.icon || '📊', {
    x: I(circX + 4), y: I(circY + circR - 9), w: I((circR - 4) * 2), h: I(18),
    fontSize: 13, fontFace: 'Segoe UI Emoji', align: 'center', valign: 'middle',
  });

  // Title
  const titleY = circY + circR * 2 + 8;
  slide.addText((kpi.title || 'Key Insight').toUpperCase(), {
    x: I(x + 8), y: I(titleY), w: I(kpiW - 16), h: I(22),
    fontSize: 7, bold: true, color: C.dark3, fontFace: 'Calibri',
    align: 'center', charSpacing: 0.5, wrap: true, valign: 'top',
  });

  // Divider
  const divY = titleY + 26;
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + 10), y: I(divY), w: I(kpiW - 20), h: I(1),
    fill: { color: C.light3 }, line: { color: C.light3 },
  });

  // Key metric (teal)
  let curY = divY + 6;
  if (kpi.keyMetric) {
    slide.addText(kpi.keyMetric, {
      x: I(x + 10), y: I(curY), w: I(kpiW - 20), h: I(30),
      fontSize: 6.5, bold: true, color: C.primary, fontFace: 'Calibri',
      wrap: true, valign: 'top', align: 'center',
    });
    curY += 34;
  }

  // Description body
  const descText = kpi.description || '';
  if (descText) {
    const descH = Math.max(28, kpiH - (curY - y) - 10);
    slide.addText(descText, {
      x: I(x + 10), y: I(curY), w: I(kpiW - 20), h: I(descH),
      fontSize: 6, color: C.dark2, fontFace: 'Calibri', wrap: true, valign: 'top',
    });
  }
}

// ── Compact exhibit card (grid layouts: grid-3, grid-4) ───────────────────────
function addGridExhibit(slide, pres, exhibit, x, y, cellW, cellH, chartData) {
  const title    = truncate(exhibit.title || `Chart ${exhibit.exhibitNum || 1}`, 60);
  const insights = (exhibit.insights || []).slice(0, 2);
  const insSectionH = insights.length > 0 ? INSPAD * 2 + insights.length * 14 + 4 : 0;
  const chartBodyH  = cellH - GRID_TITLE_H - insSectionH;
  const BADGE_W     = 58;

  // Card background
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(cellW), h: I(cellH),
    fill: { color: C.white }, line: { color: C.light4, width: 0.5 },
  });
  // Badge
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(BADGE_W), h: I(GRID_TITLE_H),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + 6), y: I(y + 7), w: I(46), h: I(GRID_TITLE_H - 14),
    fill: { color: C.white }, line: { color: C.white },
  });
  slide.addText(`EXHIBIT ${exhibit.exhibitNum || 1}`, {
    x: I(x + 6), y: I(y + 7), w: I(46), h: I(GRID_TITLE_H - 14),
    fontSize: 4.5, bold: true, color: C.dark3, fontFace: 'Calibri',
    align: 'center', valign: 'middle',
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
    fontSize: 6.5, bold: true, color: C.white, fontFace: 'Calibri', valign: 'middle',
  });
  // Chart body
  const bodyY = y + GRID_TITLE_H;
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(bodyY), w: I(cellW), h: I(chartBodyH),
    fill: { color: C.bg }, line: { color: C.bg },
  });
  addNativeChart(slide, pres, chartData, x + 6, bodyY + 5, cellW - 12, chartBodyH - 8);
  // Insight strip
  if (insights.length > 0) {
    const insY = bodyY + chartBodyH;
    slide.addShape(pres.ShapeType.rect, {
      x: I(x), y: I(insY), w: I(cellW), h: I(insSectionH),
      fill: { color: C.light5 }, line: { color: C.light3, width: 0.3 },
    });
    insights.forEach((ins, ii) => {
      const iY = insY + INSPAD + ii * 17;
      slide.addShape(pres.ShapeType.ellipse, {
        x: I(x + 8), y: I(iY + 1), w: I(10), h: I(10),
        fill: { color: C.primary }, line: { color: C.primary },
      });
      slide.addText('•', {
        x: I(x + 8), y: I(iY + 1), w: I(10), h: I(10),
        fontSize: 6, bold: true, color: C.white, fontFace: 'Calibri',
        align: 'center', valign: 'middle',
      });
      const clean = ins.replace(/\[\[(.+?)\]\]/g, '$1');
      slide.addText(truncate(clean, 80), {
        x: I(x + 22), y: I(iY), w: I(cellW - 28), h: I(14),
        fontSize: 5.5, color: C.dark3, fontFace: 'Calibri', wrap: false,
      });
    });
  }
}

// ── Key Takeaways section ────────────────────────────────────────────────────
function addTakeaways(slide, pres, takeaways, tkwY, availW, tkwH) {
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: I(tkwY), w: 8.27, h: I(tkwH),
    fill: { color: C.tkwBg }, line: { color: C.primary, width: 1.5 },
  });
  // Accent bar + label
  slide.addShape(pres.ShapeType.rect, {
    x: I(PAD), y: I(tkwY + INSPAD + 2), w: I(3), h: I(12),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText('KEY TAKEAWAYS', {
    x: I(PAD + 8), y: I(tkwY + INSPAD), w: I(200), h: I(14),
    fontSize: 6.5, bold: true, color: C.dark3, fontFace: 'Calibri',
    charSpacing: 1.5, valign: 'middle',
  });
  takeaways.forEach((ins, ii) => {
    const iY = tkwY + INSPAD + 22 + ii * (INS_ROW_H + 5);
    slide.addShape(pres.ShapeType.ellipse, {
      x: I(PAD), y: I(iY + 1), w: I(13), h: I(13),
      fill: { color: C.primary }, line: { color: C.primary },
    });
    slide.addText('✓', {
      x: I(PAD), y: I(iY + 1), w: I(13), h: I(13),
      fontSize: 5.5, bold: true, color: C.white, fontFace: 'Calibri',
      align: 'center', valign: 'middle',
    });
    // Strip [[...]] brackets for PPT (plain text — PPT can't do coloured spans)
    const clean = ins.replace(/\[\[(.+?)\]\]/g, '$1');
    slide.addText(truncate(clean, 130), {
      x: I(PAD + 17), y: I(iY), w: I(availW - 22), h: I(INS_ROW_H),
      fontSize: 6.5, color: C.dark3, fontFace: 'Calibri', wrap: false,
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function truncate(str, max) {
  return (str || '').length > max ? str.slice(0, max) + '…' : (str || '');
}

// ── Main entry point ─────────────────────────────────────────────────────────
async function renderPPT(PptxGenJS, spec, chartDataArray) {
  const { layout, slideTitle, slideSubtitle, exhibits, takeaways } = spec;
  const count = Math.min((exhibits || []).length, 4);

  const pres = new PptxGenJS();
  pres.defineLayout({ name: 'A4', width: 8.27, height: 11.69 });
  pres.layout = 'A4';
  const slide = pres.addSlide();

  addHeader(slide, pres, slideTitle, slideSubtitle);
  addBottomAccent(slide, pres);

  // ── Calculate Key Takeaways height ────────────────────────────────────────
  const tkwList  = (takeaways || []).slice(0, 5);
  const TKW_H    = tkwList.length > 0
    ? INSPAD * 2 + 22 + tkwList.length * (INS_ROW_H + 5) + 8
    : 0;
  const chartDivH = A4_H_PX - HDR_H - TKW_H;
  const availH    = chartDivH - PAD;
  const availW    = A4_W_PX - PAD * 2;

  // ── Stacked layout (1–2 charts, each with KPI panel) ─────────────────────
  if (count <= 2) {
    const exhibitH = count === 1
      ? Math.min(availH, MAX_SINGLE_H)
      : Math.floor((availH - STACK_GAP) / 2);

    for (let i = 0; i < count; i++) {
      const exhibit   = exhibits[i] || {};
      const y         = HDR_H + PAD + i * (exhibitH + STACK_GAP);
      const chartData = (chartDataArray && chartDataArray[i]) || null;
      addExhibitWithKPI(slide, pres, exhibit, PAD, y, availW, exhibitH, chartData);
    }
  }

  // ── Grid layout (3–4 charts, compact cells) ───────────────────────────────
  else {
    const cellW = Math.floor((availW - GAP) / 2);
    const cellH = Math.floor((availH - GAP) / 2);

    for (let idx = 0; idx < count; idx++) {
      const exhibit   = exhibits[idx] || {};
      let col = idx % 2;
      let row = Math.floor(idx / 2);
      let xOff = 0;
      // 3-chart: centre the third card
      if (count === 3 && idx === 2) { col = 0; row = 1; xOff = (cellW + GAP) / 2; }
      const x         = PAD + col * (cellW + GAP) + xOff;
      const y         = HDR_H + PAD + row * (cellH + GAP);
      const chartData = (chartDataArray && chartDataArray[idx]) || null;
      addGridExhibit(slide, pres, exhibit, x, y, cellW, cellH, chartData);
    }
  }

  // ── Key Takeaways ─────────────────────────────────────────────────────────
  if (TKW_H > 0) {
    addTakeaways(slide, pres, tkwList, A4_H_PX - TKW_H, availW, TKW_H);
  }

  return pres.write({ outputType: 'nodebuffer' });
}

module.exports = { renderPPT };
