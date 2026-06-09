"use client";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Bar, Line, Pie, Doughnut, Scatter } from "react-chartjs-2";
import type { ChartSpec } from "@/lib/chartConfig";
import { BRAND } from "@/lib/colors";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler, ChartDataLabels
);

// Disable datalabels globally by default — enable per chart via plugin config
ChartJS.defaults.set("plugins.datalabels", { display: false });

interface Props {
  spec: ChartSpec;
  chartId: string;
  width: number;
  height: number;
}

export default function ChartRenderer({ spec, chartId, width, height }: Props) {
  if (spec.kind === "kpi") {
    return (
      <div
        style={{
          width, height,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: `linear-gradient(135deg, ${BRAND.light5} 0%, #fff 100%)`,
          borderRadius: 8,
        }}
      >
        <span style={{
          fontSize: Math.min(width, height) * 0.26,
          fontWeight: 800, color: BRAND.primary, lineHeight: 1,
          fontFamily: "'APTOEX','Inter',sans-serif",
        }}>
          {spec.value}
        </span>
        <span style={{
          fontSize: Math.min(width, height) * 0.075,
          color: BRAND.dark2, marginTop: 8, fontWeight: 600,
          fontFamily: "'APTOEX','Inter',sans-serif",
        }}>
          {spec.label}
        </span>
      </div>
    );
  }

  if (spec.kind === "unsupported") {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#9CA3AF", fontSize: 11 }}>No data to display</span>
      </div>
    );
  }

  // Inject datalabels plugin config into chart options
  const datalabelsConfig = spec.datalabels
    ? { display: true, ...spec.datalabels }
    : { display: false };

  const commonProps = {
    id: chartId,
    width,
    height,
    style: { maxWidth: width, maxHeight: height },
  };

  if (spec.kind === "bar") {
    const opts = { ...spec.options, plugins: { ...spec.options.plugins, datalabels: datalabelsConfig } };
    return <Bar {...commonProps} data={spec.data} options={opts} />;
  }
  if (spec.kind === "line") {
    const opts = { ...spec.options, plugins: { ...spec.options.plugins, datalabels: datalabelsConfig } };
    return <Line {...commonProps} data={spec.data} options={opts} />;
  }
  if (spec.kind === "pie") return <Pie {...commonProps} data={spec.data} options={spec.options} />;
  if (spec.kind === "doughnut") return <Doughnut {...commonProps} data={spec.data} options={spec.options} />;
  if (spec.kind === "scatter") return <Scatter {...commonProps} data={spec.data} options={spec.options} />;

  return null;
}
