export type ChartTypeId =
  | "bar-vertical"
  | "bar-horizontal"
  | "grouped-bar"
  | "stacked-bar"
  | "line"
  | "multi-line"
  | "pie"
  | "donut"
  | "area"
  | "scatter"
  | "combo"
  | "kpi";

export interface ChartTypeOption {
  id: ChartTypeId;
  label: string;
  icon: string;
  description: string;
}

export const CHART_TYPES: ChartTypeOption[] = [
  { id: "bar-vertical",   label: "Bar",          icon: "📊", description: "Compare values across categories" },
  { id: "bar-horizontal", label: "H. Bar",        icon: "☰",  description: "Long labels or rankings" },
  { id: "grouped-bar",    label: "Grouped",       icon: "📶", description: "Multiple series side by side" },
  { id: "stacked-bar",    label: "Stacked",       icon: "📊", description: "Part to whole across categories" },
  { id: "line",           label: "Line",          icon: "📈", description: "Trends over time" },
  { id: "multi-line",     label: "Multi-line",    icon: "〰️", description: "Multiple trends compared" },
  { id: "pie",            label: "Pie",           icon: "🥧", description: "Proportions of a whole" },
  { id: "donut",          label: "Donut",         icon: "🍩", description: "Proportions with center callout" },
  { id: "area",           label: "Area",          icon: "⛰️", description: "Volume over time" },
  { id: "scatter",        label: "Scatter",       icon: "✦",  description: "Correlation between two variables" },
  { id: "combo",          label: "Combo",         icon: "📊", description: "Bar and line on same axis" },
  { id: "kpi",            label: "KPI Card",      icon: "🔢", description: "Single metric highlight" },
];
