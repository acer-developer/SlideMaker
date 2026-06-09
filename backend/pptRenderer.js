/**
 * pptRenderer.js
 * BCG-grade PPTX renderer with rich visual assets:
 *   - Dark header + footer frame
 *   - Left margin spine
 *   - Card drop-shadows
 *   - Stat strip (start / end / Δ% band below title bar)
 *   - Mini sparkline bar chart inside KPI panel
 *   - Trend direction badge (▲▼ + % change)
 *   - Period label pills (dark teal pill tags)
 *   - Numbered takeaway badges + alternating row shading
 */

const I  = (px) => +(px * (8.27 / 794)).toFixed(4);
const F  = 'Aptos';
const FE = 'Segoe UI Emoji';

// ── Layout constants (px) ────────────────────────────────────────────────────
const A4_W      = 794;
const A4_H      = 1123;
const HDR_H     = 74;
const FOOTER_H  = 26;
const PAD       = 22;
const RAIL_X    = 14;
const STACK_GAP = 14;
const H_GAP     = 10;
const KPI_W     = 188;
const TITLE_H   = 30;
const STAT_H    = 18;   // ← stat strip below title bar
const ANN_H     = 82;
const SRC_H     = 16;
const GAP       = 14;
const GTITLE_H  = 28;
const INSPAD    = 10;
const INS_ROW_H = 16;
const MAX_SH    = 630;

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  dark3:  '1A4A4C', dark2: '236567', dark1: '2E8388',
  pri:    '3AA4A9', l1: '52B5BA', l2: '6EC7CB',
  l3:     '91DFE2', l4: 'B5EEEF', l5: 'D5F6F7',
  white:  'FFFFFF', bg: 'F8FDFD', kpiBg: 'F0F9FA',
  tkwBg:  'E8F4F5', shadow: 'B8D4D6', altRow: 'EDF7F8',
  neg:    'FECACA', pos: 'D5F6F7',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const trunc = (s, n) => (s||'').length > n ? s.slice(0,n)+'…' : (s||'');
function fmt(n) {
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1)+'K';
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}
function trendOf(chartData) {
  const vals = chartData?.parsed?.series?.[0]?.values;
  if (!vals || vals.length < 2) return null;
  const first = vals[0], last = vals[vals.length - 1];
  const pct = ((last - first) / Math.abs(first || 1)) * 100;
  return { first, last, pct, up: last >= first };
}

// ── Header (dark band) ───────────────────────────────────────────────────────
function addHeader(slide, pres, title, subtitle) {
  slide.addShape(pres.ShapeType.rect, { x:0, y:0, w:8.27, h:I(HDR_H), fill:{color:C.dark3}, line:{color:C.dark3} });
  slide.addShape(pres.ShapeType.rect, { x:0, y:0, w:I(6), h:I(HDR_H), fill:{color:C.pri}, line:{color:C.pri} });
  slide.addShape(pres.ShapeType.rect, { x:0, y:I(HDR_H), w:8.27, h:I(3), fill:{color:C.pri}, line:{color:C.pri} });
  slide.addText('RESEARCH REPORT', {
    x:I(A4_W-100), y:I(10), w:I(88), h:I(12),
    fontSize:5, color:C.l3, fontFace:F, align:'right', charSpacing:1.6, valign:'middle',
  });
  slide.addText((title||'DATA ANALYSIS REPORT').toUpperCase(), {
    x:I(PAD+4), y:I(11), w:I(A4_W-PAD*2-100), h:I(28),
    fontSize:12, bold:true, color:C.white, fontFace:F, charSpacing:0.7, valign:'middle',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x:I(PAD+4), y:I(43), w:I(A4_W-PAD*2-60), h:I(22),
      fontSize:6.5, color:C.l4, fontFace:F, wrap:true, valign:'top',
    });
  }
}

// ── Footer (mirrors header) ───────────────────────────────────────────────────
function addFooter(slide, pres, slideTitle) {
  const fy = A4_H - FOOTER_H;
  slide.addShape(pres.ShapeType.rect, { x:0, y:I(fy-2), w:8.27, h:I(2), fill:{color:C.pri}, line:{color:C.pri} });
  slide.addShape(pres.ShapeType.rect, { x:0, y:I(fy), w:8.27, h:I(FOOTER_H), fill:{color:C.dark3}, line:{color:C.dark3} });
  slide.addShape(pres.ShapeType.rect, { x:0, y:I(fy), w:I(6), h:I(FOOTER_H), fill:{color:C.pri}, line:{color:C.pri} });
  slide.addText((slideTitle||'DATA ANALYSIS').toUpperCase(), {
    x:I(PAD+2), y:I(fy+6), w:I(360), h:I(14),
    fontSize:5.5, color:C.l4, fontFace:F, charSpacing:0.8, valign:'middle',
  });
  slide.addText('CONFIDENTIAL', {
    x:I(A4_W-90), y:I(fy+6), w:I(78), h:I(14),
    fontSize:5.5, color:C.l3, fontFace:F, align:'right', charSpacing:1.4, valign:'middle',
  });
}

// ── Left margin spine ─────────────────────────────────────────────────────────
function addLeftRail(slide, pres) {
  slide.addShape(pres.ShapeType.line, {
    x:I(RAIL_X), y:I(HDR_H+3+8), w:0, h:I(A4_H-HDR_H-FOOTER_H-18),
    line:{ color:C.dark2, pt:1.2, dashType:'solid' },
  });
}

// ── Chart type resolver ───────────────────────────────────────────────────────
function resolveChart(pres, t) {
  switch (t) {
    case 'bar-horizontal': return { type:pres.ChartType.bar,      extra:{ barDir:'bar' } };
    case 'stacked-bar':    return { type:pres.ChartType.bar,      extra:{ barDir:'col', barGrouping:'stacked' } };
    case 'line':
    case 'multi-line':     return { type:pres.ChartType.line,     extra:{} };
    case 'area':           return { type:pres.ChartType.area,     extra:{} };
    case 'pie':            return { type:pres.ChartType.pie,      extra:{} };
    case 'donut':          return { type:pres.ChartType.doughnut, extra:{} };
    case 'scatter':        return { type:pres.ChartType.scatter,  extra:{} };
    default:               return { type:pres.ChartType.bar,      extra:{ barDir:'col' } };
  }
}

// ── Native chart ─────────────────────────────────────────────────────────────
function addNativeChart(slide, pres, chartData, x, y, w, h) {
  const parsed    = chartData?.parsed || { labels:[], series:[] };
  const chartType = chartData?.chartType || null;
  if (!parsed.labels?.length || !parsed.series?.length) {
    slide.addText('No chart data', {
      x:I(x), y:I(y+h/2-10), w:I(w), h:I(20),
      fontSize:9, color:'8AABAC', fontFace:F, align:'center', valign:'middle',
    });
    return;
  }
  const { labels, series } = parsed;
  if (chartType === 'kpi') {
    const val = series[0]?.values[0] ?? 0;
    slide.addText(fmt(val), {
      x:I(x), y:I(y+h/2-22), w:I(w), h:I(44),
      fontSize:34, bold:true, color:C.dark3, fontFace:F, align:'center', valign:'middle',
    });
    slide.addText(series[0]?.name||'', {
      x:I(x), y:I(y+h/2+22), w:I(w), h:I(16),
      fontSize:8, color:C.pri, fontFace:F, align:'center',
    });
    return;
  }
  const { type, extra } = resolveChart(pres, chartType);
  const isPie = (chartType==='pie'||chartType==='donut');
  const multi = series.length > 1;
  const opts = {
    x:I(x), y:I(y), w:I(w), h:I(h),
    chartColors:['3AA4A9','1A4A4C','52B5BA','91DFE2','6EC7CB'],
    lineSize:2, lineSmooth:false,
    showValAxis:!isPie, showCatAxis:!isPie,
    valAxisFontSize:7, catAxisFontSize:7,
    valAxisFontFace:F, catAxisFontFace:F,
    valAxisFontColor:'5C7C7E', catAxisFontColor:'5C7C7E',
    valGridLine:{ style:'solid', color:'E4F2F3', size:0.5 },
    catGridLine:{ style:'none' },
    showValue:!isPie, dataLabelFontSize:7,
    dataLabelFontFace:F, dataLabelColor:C.dark2, dataLabelPosition:'outEnd',
    showLegend:isPie?true:multi, legendFontSize:7,
    legendFontFace:F, legendColor:C.dark3, legendPos:'b',
    plotAreaBorderColor:C.white,
    ...extra,
  };
  if (isPie) { opts.showLeaderLines=true; opts.showValue=false; }
  slide.addChart(type, series.map(s=>({ name:s.name, labels, values:s.values })), opts);
}

// ── NEW: Stat strip (start / end / Δ%) ───────────────────────────────────────
function addStatStrip(slide, pres, chartData, x, y, cardW) {
  const labels = chartData?.parsed?.labels || [];
  const vals   = chartData?.parsed?.series?.[0]?.values || [];
  if (vals.length < 2) {
    slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(y), w:I(cardW), h:I(STAT_H), fill:{color:C.dark2}, line:{color:C.dark2} });
    return;
  }
  const first = vals[0], last = vals[vals.length-1];
  const pct   = ((last-first)/Math.abs(first||1)*100);
  const chips = [
    { label: labels[0]||'Start',                        value: fmt(first) },
    { label: labels[labels.length-1]||'Latest',         value: fmt(last)  },
    { label: 'Change',  value: (pct>=0?'+':'')+pct.toFixed(1)+'%', hi: true, up: pct>=0 },
  ];
  const cW = Math.floor(cardW / 3);
  // Strip background
  slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(y), w:I(cardW), h:I(STAT_H), fill:{color:C.dark2}, line:{color:C.dark2} });
  chips.forEach((chip, i) => {
    const cx = x + i * cW;
    if (i > 0) {
      slide.addShape(pres.ShapeType.line, {
        x:I(cx), y:I(y+3), w:0, h:I(STAT_H-6),
        line:{ color:C.l3, pt:0.4 },
      });
    }
    const valColor = chip.hi ? (chip.up ? C.l5 : C.neg) : C.l4;
    slide.addText(chip.value, {
      x:I(cx+3), y:I(y+1), w:I(cW-6), h:I(10),
      fontSize:7, bold:true, color:valColor, fontFace:F, align:'center',
    });
    slide.addText(chip.label, {
      x:I(cx+3), y:I(y+11), w:I(cW-6), h:I(7),
      fontSize:4.5, color:C.l3, fontFace:F, align:'center', charSpacing:0.5,
    });
  });
}

// ── NEW: Mini sparkline (dark bg bar chart) ───────────────────────────────────
function addMiniSparkline(slide, pres, chartData, x, y, w, h) {
  const vals = chartData?.parsed?.series?.[0]?.values;
  // Background
  slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(y), w:I(w), h:I(h), fill:{color:C.dark3}, line:{color:C.dark3} });
  if (!vals?.length) return;
  const min  = Math.min(...vals), max = Math.max(...vals);
  const range = (max-min) || 1;
  const n     = Math.min(vals.length, 14);
  const bw    = Math.max(2, Math.floor((w-4) / n) - 1);
  vals.slice(-n).forEach((v, i) => {
    const bh = Math.max(2, Math.round(((v-min)/range) * (h-6)));
    const bx = x + 2 + i*(bw+1);
    const by = y + h - bh - 2;
    const isLast = i === Math.min(vals.length,n)-1;
    slide.addShape(pres.ShapeType.rect, {
      x:I(bx), y:I(by), w:I(bw), h:I(bh),
      fill:{ color: isLast ? C.l3 : C.dark1 }, line:{ color: isLast ? C.l3 : C.dark1 },
    });
  });
  slide.addText('TREND', {
    x:I(x), y:I(y+h+2), w:I(w), h:I(7),
    fontSize:4, color:C.l3, fontFace:F, align:'center', charSpacing:1.4,
  });
}

// ── NEW: Trend badge (▲ / ▼ + Δ%) ────────────────────────────────────────────
function addTrendBadge(slide, pres, chartData, x, y, w) {
  const t = trendOf(chartData);
  if (!t) return;
  const badgeColor = t.up ? C.pri : C.dark2;
  const arrow      = t.up ? '▲' : '▼';
  const pctStr     = (t.up?'+':'')+t.pct.toFixed(1)+'%';
  slide.addShape(pres.ShapeType.rect, {
    x:I(x), y:I(y), w:I(w), h:I(18),
    fill:{color:badgeColor}, line:{color:badgeColor},
  });
  slide.addText(arrow+' '+pctStr, {
    x:I(x+2), y:I(y+2), w:I(w-4), h:I(14),
    fontSize:7, bold:true, color:C.white, fontFace:F, align:'center', valign:'middle',
  });
}

// ── KPI panel ────────────────────────────────────────────────────────────────
function addKPIPanel(slide, pres, exhibit, x, y, kpiW, kpiH, chartData) {
  const kpi = exhibit.kpi || {};
  // Shadow
  slide.addShape(pres.ShapeType.rect, { x:I(x+3), y:I(y+3), w:I(kpiW), h:I(kpiH), fill:{color:C.shadow}, line:{color:C.shadow} });
  // Panel bg
  slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(y), w:I(kpiW), h:I(kpiH), fill:{color:C.kpiBg}, line:{color:C.l3, width:0.8} });
  // Top two-tone accent
  slide.addShape(pres.ShapeType.rect, { x:I(x),           y:I(y), w:I(kpiW/2), h:I(5), fill:{color:C.dark2}, line:{color:C.dark2} });
  slide.addShape(pres.ShapeType.rect, { x:I(x+kpiW/2),    y:I(y), w:I(kpiW/2), h:I(5), fill:{color:C.pri},   line:{color:C.pri}   });

  // Icon circle
  const cr = 26, cx = x+kpiW/2-cr, cy = y+14;
  slide.addShape(pres.ShapeType.ellipse, { x:I(cx), y:I(cy), w:I(cr*2), h:I(cr*2), fill:{color:C.dark3}, line:{color:C.pri, width:2} });
  slide.addShape(pres.ShapeType.ellipse, { x:I(cx+6), y:I(cy+6), w:I((cr-6)*2), h:I((cr-6)*2), fill:{type:'none'}, line:{color:C.l3, width:0.8} });
  slide.addText(kpi.icon||'📊', { x:I(cx+4), y:I(cy+cr-9), w:I((cr-4)*2), h:I(18), fontSize:13, fontFace:FE, align:'center', valign:'middle' });

  // Title
  const titleY = cy + cr*2 + 8;
  slide.addText((kpi.title||'Key Insight').toUpperCase(), {
    x:I(x+8), y:I(titleY), w:I(kpiW-16), h:I(22),
    fontSize:7, bold:true, color:C.dark3, fontFace:F, align:'center', charSpacing:0.6, wrap:true, valign:'top',
  });

  // Divider
  const div1Y = titleY + 24;
  slide.addShape(pres.ShapeType.rect, { x:I(x+14), y:I(div1Y), w:I(kpiW-28), h:I(1.5), fill:{color:C.pri}, line:{color:C.pri} });

  // Trend badge
  let curY = div1Y + 6;
  addTrendBadge(slide, pres, chartData, x+10, curY, kpiW-20);
  curY += 22;

  // Key metric
  if (kpi.keyMetric) {
    slide.addText(kpi.keyMetric, {
      x:I(x+10), y:I(curY), w:I(kpiW-20), h:I(30),
      fontSize:6.5, bold:true, color:C.pri, fontFace:F, wrap:true, valign:'top', align:'center',
    });
    curY += 32;
  }

  // Thin divider
  slide.addShape(pres.ShapeType.rect, { x:I(x+20), y:I(curY-2), w:I(kpiW-40), h:I(1), fill:{color:C.l4}, line:{color:C.l4} });

  // Description
  if (kpi.description) {
    const descH = Math.max(24, kpiH-(curY-y)-32);
    slide.addText(kpi.description, {
      x:I(x+10), y:I(curY), w:I(kpiW-20), h:I(descH),
      fontSize:6, color:C.dark2, fontFace:F, wrap:true, valign:'top',
    });
    curY += descH + 4;
  }

  // Mini sparkline (dark bg bar) — fills remaining space
  const sparkH = Math.max(22, kpiH - (curY - y) - 12);
  if (sparkH >= 16) {
    addMiniSparkline(slide, pres, chartData, x+10, curY, kpiW-20, sparkH);
  }
}

// ── Exhibit with KPI ─────────────────────────────────────────────────────────
function addExhibitWithKPI(slide, pres, exhibit, x, y, availW, exhibitH, chartData) {
  const chartCardW = availW - KPI_W - H_GAP;
  const kpiX       = x + chartCardW + H_GAP;
  const hasAnns    = Array.isArray(exhibit.annotations) && exhibit.annotations.length > 0;
  const hasSrc     = !!exhibit.source;
  const annH       = hasAnns ? ANN_H : 0;
  const srcH       = hasSrc  ? SRC_H : 0;
  const chartBodyH = exhibitH - TITLE_H - STAT_H - annH - srcH;

  addChartCard(slide, pres, exhibit, x, y, chartCardW, exhibitH, chartBodyH, annH, srcH, chartData);
  addKPIPanel(slide, pres, exhibit, kpiX, y, KPI_W, exhibitH, chartData);
}

// ── Chart card ────────────────────────────────────────────────────────────────
function addChartCard(slide, pres, exhibit, x, y, cardW, cardH, chartBodyH, annH, srcH, chartData) {
  const title  = trunc(exhibit.title||`Chart ${exhibit.exhibitNum||1}`, 72);
  const BADGE  = 66;

  // Shadow
  slide.addShape(pres.ShapeType.rect, { x:I(x+3), y:I(y+3), w:I(cardW), h:I(cardH), fill:{color:C.shadow}, line:{color:C.shadow} });
  // Card
  slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(y), w:I(cardW), h:I(cardH), fill:{color:C.white}, line:{color:C.l4, width:0.5} });
  // Left border strip
  slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(y), w:I(4), h:I(cardH), fill:{color:C.pri}, line:{color:C.pri} });

  // Exhibit badge
  slide.addShape(pres.ShapeType.rect, { x:I(x+4), y:I(y), w:I(BADGE), h:I(TITLE_H), fill:{color:C.pri}, line:{color:C.pri} });
  slide.addShape(pres.ShapeType.rect, { x:I(x+10), y:I(y+8), w:I(52), h:I(TITLE_H-16), fill:{color:C.white}, line:{color:C.white} });
  slide.addText(`EXHIBIT ${exhibit.exhibitNum||1}`, {
    x:I(x+10), y:I(y+8), w:I(52), h:I(TITLE_H-16),
    fontSize:5, bold:true, color:C.dark3, fontFace:F, align:'center', valign:'middle',
  });

  // Dark title bar
  slide.addShape(pres.ShapeType.rect, { x:I(x+4+BADGE), y:I(y), w:I(cardW-4-BADGE), h:I(TITLE_H), fill:{color:C.dark3}, line:{color:C.dark3} });
  slide.addShape(pres.ShapeType.rect, { x:I(x+4+BADGE), y:I(y+TITLE_H-2), w:I(cardW-4-BADGE), h:I(2), fill:{color:C.pri}, line:{color:C.pri} });
  slide.addText(title, {
    x:I(x+4+BADGE+8), y:I(y+5), w:I(cardW-4-BADGE-16), h:I(TITLE_H-8),
    fontSize:7, bold:true, color:C.white, fontFace:F, valign:'middle',
  });

  // ── Stat strip (start / end / Δ%) ──
  const statY = y + TITLE_H;
  addStatStrip(slide, pres, chartData, x, statY, cardW);

  // Chart body
  const bodyY = statY + STAT_H;
  slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(bodyY), w:I(cardW), h:I(chartBodyH), fill:{color:C.bg}, line:{color:C.bg} });
  addNativeChart(slide, pres, chartData, x+8, bodyY+6, cardW-16, chartBodyH-10);

  // Annotations
  if (annH > 0 && exhibit.annotations?.length > 0) {
    addAnnotations(slide, pres, exhibit.annotations, x, bodyY+chartBodyH, cardW, annH);
  }

  // Source
  if (srcH > 0 && exhibit.source) {
    const srcY = bodyY + chartBodyH + annH;
    slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(srcY), w:I(cardW), h:I(srcH), fill:{color:C.bg}, line:{color:C.l4, width:0.3} });
    slide.addText(`Source: ${exhibit.source}`, {
      x:I(x+10), y:I(srcY+3), w:I(cardW-20), h:I(srcH-4),
      fontSize:5, italic:true, color:'8AABAC', fontFace:F, valign:'middle',
    });
  }
}

// ── Annotations row ──────────────────────────────────────────────────────────
function addAnnotations(slide, pres, annotations, x, annY, cardW, annH) {
  slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(annY), w:I(cardW), h:I(annH), fill:{color:'F3F9FA'}, line:{color:C.l4, width:0.3} });
  const cW = Math.floor(cardW / 3);
  annotations.slice(0,3).forEach((ann, i) => {
    const aX = x + i*cW, midX = aX + cW/2, pW = 36;
    if (i > 0) slide.addShape(pres.ShapeType.line, { x:I(aX), y:I(annY+5), w:0, h:I(annH-10), line:{color:C.l3, pt:0.5, dashType:'dash'} });
    const lw = Math.max(0, midX-aX-8-pW/2-4);
    if (lw>0) slide.addShape(pres.ShapeType.line, { x:I(aX+8), y:I(annY+12), w:I(lw), h:0, line:{color:C.l3, pt:0.7, dashType:'dash'} });
    const rs = midX+pW/2+4, rw = Math.max(0, aX+cW-8-rs);
    if (rw>0) slide.addShape(pres.ShapeType.line, { x:I(rs), y:I(annY+12), w:I(rw), h:0, line:{color:C.l3, pt:0.7, dashType:'dash'} });
    slide.addText('◄', { x:I(aX+4),        y:I(annY+7), w:I(8), h:I(10), fontSize:4.5, color:C.dark1, fontFace:F, align:'center' });
    slide.addText('►', { x:I(aX+cW-12),    y:I(annY+7), w:I(8), h:I(10), fontSize:4.5, color:C.dark1, fontFace:F, align:'center' });
    // Period pill (dark teal)
    slide.addShape(pres.ShapeType.rect, { x:I(midX-pW/2-2), y:I(annY+4), w:I(pW+4), h:I(13), fill:{color:C.dark3}, line:{color:C.dark3} });
    slide.addText((ann.period||'').toUpperCase(), {
      x:I(midX-pW/2-2), y:I(annY+4), w:I(pW+4), h:I(13),
      fontSize:4.5, bold:true, color:C.l5, fontFace:F, align:'center', valign:'middle', charSpacing:0.3,
    });
    const io = ann.icon ? 18 : 0;
    if (ann.icon) slide.addText(ann.icon, { x:I(aX+cW/2-8), y:I(annY+19), w:I(16), h:I(16), fontSize:9, fontFace:FE, align:'center' });
    slide.addText(ann.label||'', { x:I(aX+6), y:I(annY+23+io), w:I(cW-12), h:I(11), fontSize:6, bold:true, color:C.dark3, fontFace:F });
    const dy = annY+35+io, dh = Math.max(4, annH-(dy-annY)-4);
    slide.addText(ann.description||'', { x:I(aX+6), y:I(dy), w:I(cW-12), h:I(dh), fontSize:5.5, color:C.dark1, fontFace:F, wrap:true, valign:'top' });
  });
}

// ── Grid exhibit (3–4 chart layouts) ─────────────────────────────────────────
function addGridExhibit(slide, pres, exhibit, x, y, cellW, cellH, chartData) {
  const title    = trunc(exhibit.title||`Chart ${exhibit.exhibitNum||1}`, 60);
  const insights = (exhibit.insights||[]).slice(0,2);
  const insSH    = insights.length > 0 ? INSPAD*2 + insights.length*14 + 4 : 0;
  const bodyH    = cellH - GTITLE_H - STAT_H - insSH;
  const BADGE    = 58;

  // Shadow
  slide.addShape(pres.ShapeType.rect, { x:I(x+3), y:I(y+3), w:I(cellW), h:I(cellH), fill:{color:C.shadow}, line:{color:C.shadow} });
  // Card
  slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(y), w:I(cellW), h:I(cellH), fill:{color:C.white}, line:{color:C.l4, width:0.5} });
  // Left strip
  slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(y), w:I(4), h:I(cellH), fill:{color:C.pri}, line:{color:C.pri} });
  // Badge
  slide.addShape(pres.ShapeType.rect, { x:I(x+4), y:I(y), w:I(BADGE), h:I(GTITLE_H), fill:{color:C.pri}, line:{color:C.pri} });
  slide.addShape(pres.ShapeType.rect, { x:I(x+9),  y:I(y+7), w:I(46), h:I(GTITLE_H-14), fill:{color:C.white}, line:{color:C.white} });
  slide.addText(`EXHIBIT ${exhibit.exhibitNum||1}`, {
    x:I(x+9), y:I(y+7), w:I(46), h:I(GTITLE_H-14),
    fontSize:4.5, bold:true, color:C.dark3, fontFace:F, align:'center', valign:'middle',
  });
  slide.addShape(pres.ShapeType.rect, { x:I(x+4+BADGE), y:I(y), w:I(cellW-4-BADGE), h:I(GTITLE_H), fill:{color:C.dark3}, line:{color:C.dark3} });
  slide.addShape(pres.ShapeType.rect, { x:I(x+4+BADGE), y:I(y+GTITLE_H-2), w:I(cellW-4-BADGE), h:I(2), fill:{color:C.pri}, line:{color:C.pri} });
  slide.addText(title, {
    x:I(x+4+BADGE+7), y:I(y+4), w:I(cellW-4-BADGE-12), h:I(GTITLE_H-6),
    fontSize:6.5, bold:true, color:C.white, fontFace:F, valign:'middle',
  });

  // Stat strip
  const statY = y + GTITLE_H;
  addStatStrip(slide, pres, chartData, x, statY, cellW);

  // Chart body
  const bY = statY + STAT_H;
  slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(bY), w:I(cellW), h:I(bodyH), fill:{color:C.bg}, line:{color:C.bg} });
  addNativeChart(slide, pres, chartData, x+6, bY+5, cellW-12, bodyH-8);

  // Insight strip
  if (insights.length > 0) {
    const insY = bY + bodyH;
    slide.addShape(pres.ShapeType.rect, { x:I(x), y:I(insY), w:I(cellW), h:I(insSH), fill:{color:C.tkwBg}, line:{color:C.l3, width:0.3} });
    insights.forEach((ins, ii) => {
      const iY = insY + INSPAD + ii*17;
      slide.addShape(pres.ShapeType.ellipse, { x:I(x+8), y:I(iY+1), w:I(10), h:I(10), fill:{color:C.dark3}, line:{color:C.dark3} });
      slide.addText(`${ii+1}`, { x:I(x+8), y:I(iY+1), w:I(10), h:I(10), fontSize:5, bold:true, color:C.white, fontFace:F, align:'center', valign:'middle' });
      slide.addText(trunc(ins.replace(/\[\[(.+?)\]\]/g,'$1'),80), {
        x:I(x+22), y:I(iY), w:I(cellW-28), h:I(14), fontSize:5.5, color:C.dark3, fontFace:F, wrap:false,
      });
    });
  }
}

// ── Key Takeaways ────────────────────────────────────────────────────────────
function addTakeaways(slide, pres, takeaways, tkwY, availW, tkwH) {
  // Background
  slide.addShape(pres.ShapeType.rect, { x:0, y:I(tkwY), w:8.27, h:I(tkwH), fill:{color:C.tkwBg}, line:{color:C.tkwBg} });
  // Top border
  slide.addShape(pres.ShapeType.rect, { x:0, y:I(tkwY), w:8.27, h:I(2), fill:{color:C.dark1}, line:{color:C.dark1} });
  // Left strip
  slide.addShape(pres.ShapeType.rect, { x:0, y:I(tkwY), w:I(5), h:I(tkwH), fill:{color:C.pri}, line:{color:C.pri} });
  // Header band
  const hdH = 20;
  slide.addShape(pres.ShapeType.rect, { x:I(5), y:I(tkwY), w:I(A4_W-5), h:I(hdH), fill:{color:C.dark3}, line:{color:C.dark3} });
  slide.addText('KEY TAKEAWAYS', {
    x:I(PAD+4), y:I(tkwY+3), w:I(200), h:I(hdH-4),
    fontSize:6.5, bold:true, color:C.white, fontFace:F, charSpacing:1.8, valign:'middle',
  });
  // Items
  takeaways.forEach((ins, ii) => {
    const iY = tkwY + hdH + INSPAD + ii*(INS_ROW_H+4);
    if (ii%2===0) {
      slide.addShape(pres.ShapeType.rect, { x:I(5), y:I(iY-2), w:I(A4_W-5), h:I(INS_ROW_H+4), fill:{color:C.altRow}, line:{color:C.altRow} });
    }
    slide.addShape(pres.ShapeType.ellipse, { x:I(PAD), y:I(iY+1), w:I(13), h:I(13), fill:{color:C.dark3}, line:{color:C.pri, width:1} });
    slide.addText(`${ii+1}`, { x:I(PAD), y:I(iY+1), w:I(13), h:I(13), fontSize:5.5, bold:true, color:C.white, fontFace:F, align:'center', valign:'middle' });
    slide.addText(trunc(ins.replace(/\[\[(.+?)\]\]/g,'$1'),130), {
      x:I(PAD+17), y:I(iY), w:I(availW-22), h:I(INS_ROW_H),
      fontSize:6.5, color:C.dark3, fontFace:F, wrap:false,
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function renderPPT(PptxGenJS, spec, chartDataArray) {
  const { layout, slideTitle, slideSubtitle, exhibits, takeaways } = spec;
  const count = Math.min((exhibits||[]).length, 4);

  const pres = new PptxGenJS();
  pres.defineLayout({ name:'A4', width:8.27, height:11.69 });
  pres.layout = 'A4';
  const slide = pres.addSlide();

  addHeader(slide, pres, slideTitle, slideSubtitle);
  addFooter(slide, pres, slideTitle);
  addLeftRail(slide, pres);

  // Takeaways height
  const tkwList = (takeaways||[]).slice(0,5);
  const TKW_H   = tkwList.length > 0 ? 20 + INSPAD + tkwList.length*(INS_ROW_H+4) + INSPAD : 0;

  const bottom  = A4_H - FOOTER_H - 2;
  const availH  = bottom - HDR_H - 3 - TKW_H - PAD;
  const availW  = A4_W - PAD*2;

  // 1–2 charts (stacked + KPI)
  if (count <= 2) {
    const eH = count === 1 ? Math.min(availH, MAX_SH) : Math.floor((availH - STACK_GAP) / 2);
    for (let i=0; i<count; i++) {
      const exhibit   = exhibits[i] || {};
      const y         = HDR_H + 3 + PAD + i*(eH+STACK_GAP);
      const chartData = chartDataArray?.[i] || null;
      addExhibitWithKPI(slide, pres, exhibit, PAD, y, availW, eH, chartData);
    }
  }

  // 3–4 charts (grid)
  else {
    const cW = Math.floor((availW - GAP) / 2);
    const cH = Math.floor((availH - GAP) / 2);
    for (let idx=0; idx<count; idx++) {
      const exhibit = exhibits[idx] || {};
      let col = idx%2, row = Math.floor(idx/2), xOff = 0;
      if (count===3 && idx===2) { col=0; row=1; xOff=(cW+GAP)/2; }
      const x = PAD + col*(cW+GAP) + xOff;
      const y = HDR_H + 3 + PAD + row*(cH+GAP);
      addGridExhibit(slide, pres, exhibit, x, y, cW, cH, chartDataArray?.[idx]||null);
    }
  }

  // Takeaways
  if (TKW_H > 0) addTakeaways(slide, pres, tkwList, bottom-TKW_H, availW, TKW_H);

  return pres.write({ outputType:'nodebuffer' });
}

module.exports = { renderPPT };
