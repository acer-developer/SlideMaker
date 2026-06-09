import type { ChartTypeId } from './chartTypes';
import type { ParsedData } from './parseData';
import { CHART_PALETTE, BRAND } from './colors';
import type { ChartData, ChartOptions } from 'chart.js';

function alpha(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function formatVal(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1);
}

const BASE_SCALES = {
  x: {
    grid: { display: false },
    ticks: { font: { size: 9, family: "'APTOEX','Inter',sans-serif" }, color: '#5C7C7E', maxRotation: 45 },
    border: { display: false },
  },
  y: {
    grid: { color: '#EEF7F8', drawBorder: false },
    ticks: {
      font: { size: 9, family: "'APTOEX','Inter',sans-serif" },
      color: '#5C7C7E',
      callback: (v: number | string) => typeof v === 'number' ? formatVal(v) : v,
    },
    border: { display: false },
  },
};

// datalabels plugin config for bars
const BAR_DATALABELS = {
  anchor: 'end' as const,
  align: 'end' as const,
  offset: 2,
  font: { size: 8, weight: 'bold' as const, family: "'APTOEX','Inter',sans-serif" },
  color: BRAND.dark2,
  formatter: (v: number) => formatVal(v),
};

// datalabels config for line points
const LINE_DATALABELS = {
  anchor: 'top' as const,
  align: 'top' as const,
  offset: 4,
  font: { size: 8, weight: 'bold' as const, family: "'APTOEX','Inter',sans-serif" },
  color: BRAND.dark2,
  formatter: (v: number) => formatVal(v),
};

export type ChartSpec =
  | { kind: 'bar'; data: ChartData<'bar'>; options: ChartOptions<'bar'>; datalabels: typeof BAR_DATALABELS }
  | { kind: 'line'; data: ChartData<'line'>; options: ChartOptions<'line'>; datalabels: typeof LINE_DATALABELS }
  | { kind: 'pie'; data: ChartData<'pie'>; options: ChartOptions<'pie'>; datalabels: null }
  | { kind: 'doughnut'; data: ChartData<'doughnut'>; options: ChartOptions<'doughnut'>; datalabels: null }
  | { kind: 'scatter'; data: ChartData<'scatter'>; options: ChartOptions<'scatter'>; datalabels: null }
  | { kind: 'kpi'; value: string; label: string; datalabels: null }
  | { kind: 'unsupported'; datalabels: null };

export function buildChartSpec(type: ChartTypeId | null, parsed: ParsedData): ChartSpec {
  const { labels, series } = parsed;
  if (!labels.length || !series.length) return { kind: 'unsupported', datalabels: null };

  const effectiveType = type ?? autoDetect(parsed);

  if (effectiveType === 'kpi') {
    const total = series[0]?.values.reduce((a, b) => a + b, 0) ?? 0;
    return { kind: 'kpi', value: formatVal(total), label: series[0]?.name ?? 'Total', datalabels: null };
  }

  if (effectiveType === 'pie' || effectiveType === 'donut') {
    const vals = series[0]?.values ?? [];
    const d: ChartData<'pie'> = {
      labels,
      datasets: [{
        data: vals,
        backgroundColor: CHART_PALETTE.map(c => alpha(c, 0.88)),
        borderColor: '#fff',
        borderWidth: 2,
      }],
    };
    const opts: ChartOptions<'pie'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { size: 9, family: "'APTOEX','Inter',sans-serif" }, color: BRAND.dark3, boxWidth: 10, padding: 8 },
        },
      },
    };
    return { kind: effectiveType === 'donut' ? 'doughnut' : 'pie', data: d as ChartData<'doughnut'>, options: opts as ChartOptions<'doughnut'>, datalabels: null };
  }

  if (effectiveType === 'line' || effectiveType === 'multi-line' || effectiveType === 'area') {
    const isFill = effectiveType === 'area';
    const d: ChartData<'line'> = {
      labels,
      datasets: series.map((s, i) => ({
        label: s.name,
        data: s.values,
        borderColor: CHART_PALETTE[i % CHART_PALETTE.length],
        backgroundColor: alpha(CHART_PALETTE[i % CHART_PALETTE.length], isFill ? 0.18 : 0.06),
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#fff',
        pointBorderColor: CHART_PALETTE[i % CHART_PALETTE.length],
        pointBorderWidth: 2,
        tension: 0.35,
        fill: isFill,
      })),
    };
    const opts: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: series.length > 1,
          labels: { font: { size: 9, family: "'APTOEX','Inter',sans-serif" }, color: BRAND.dark2, boxWidth: 10, padding: 10 },
        },
        tooltip: { enabled: true },
      },
      scales: BASE_SCALES as ChartOptions<'line'>['scales'],
      layout: { padding: { top: 20, right: 10, bottom: 4, left: 4 } },
    };
    return { kind: 'line', data: d, options: opts, datalabels: LINE_DATALABELS };
  }

  if (effectiveType === 'scatter') {
    const d: ChartData<'scatter'> = {
      datasets: [{
        label: series[0]?.name ?? '',
        data: series[0]?.values.map((v, i) => ({ x: i, y: v })) ?? [],
        backgroundColor: alpha(CHART_PALETTE[0], 0.7),
        borderColor: CHART_PALETTE[0],
        pointRadius: 5,
        pointHoverRadius: 7,
      }],
    };
    const opts: ChartOptions<'scatter'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: BASE_SCALES as ChartOptions<'scatter'>['scales'],
    };
    return { kind: 'scatter', data: d, options: opts, datalabels: null };
  }

  // Bar variants
  const isHorizontal = effectiveType === 'bar-horizontal';
  const isStacked = effectiveType === 'stacked-bar';

  const d: ChartData<'bar'> = {
    labels,
    datasets: series.map((s, i) => ({
      label: s.name,
      data: s.values,
      backgroundColor: alpha(CHART_PALETTE[i % CHART_PALETTE.length], 0.85),
      borderColor: CHART_PALETTE[i % CHART_PALETTE.length],
      borderWidth: 0,
      borderRadius: 4,
      borderSkipped: false,
    })),
  };

  const barScales = isHorizontal ? {
    x: BASE_SCALES.y,
    y: { ...BASE_SCALES.x, ticks: { ...BASE_SCALES.x.ticks, maxRotation: 0 } },
  } : BASE_SCALES;

  const opts: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: isHorizontal ? 'y' : 'x',
    plugins: {
      legend: {
        display: series.length > 1,
        labels: { font: { size: 9, family: "'APTOEX','Inter',sans-serif" }, color: BRAND.dark2, boxWidth: 10, padding: 10 },
      },
      tooltip: { enabled: true },
    },
    scales: {
      ...barScales,
      x: { ...(isHorizontal ? BASE_SCALES.y : BASE_SCALES.x), stacked: isStacked },
      y: { ...(isHorizontal ? BASE_SCALES.x : BASE_SCALES.y), stacked: isStacked },
    } as ChartOptions<'bar'>['scales'],
    layout: { padding: { top: isHorizontal ? 4 : 24, right: 10, bottom: 4, left: 4 } },
  };

  return { kind: 'bar', data: d, options: opts, datalabels: BAR_DATALABELS };
}

function autoDetect(parsed: ParsedData): ChartTypeId {
  const { series, labels } = parsed;
  if (labels.length === 1) return 'kpi';
  if (series.length === 1 && labels.length <= 6) return 'pie';
  if (series.length > 1) return 'grouped-bar';
  return 'bar-vertical';
}
