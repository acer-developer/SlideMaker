export interface ParsedData {
  labels: string[];
  series: { name: string; values: number[] }[];
}

/**
 * parseCSV — handles both header and no-header data formats:
 *   "Period,USD/INR\nFY21,73.8\n..."  → header detected (USD/INR is text)
 *   "FY21,73.8\nFY22,74.6\n..."       → no header (73.8 is a number)
 *   "73.8\n74.6\n82.3\n..."            → single value column
 */
const isNum = (s: string) =>
  s !== "" && !isNaN(parseFloat(s.replace(/[^0-9.-]/g, "")));

export function parseCSV(raw: string): ParsedData {
  const lines = raw.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 1) return { labels: [], series: [] };

  const delimiter = raw.includes("\t") ? "\t" : ",";
  const rows = lines.map(l =>
    l.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ""))
  );

  const r0 = rows[0];

  // Header detection: second cell of row 0 is NOT a number → header row
  const hasHeader = r0.length >= 2 && !isNum(r0[1]);

  const headers  = hasHeader ? r0 : null;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (dataRows.length === 0) return { labels: [], series: [] };

  const numCols = Math.max(...dataRows.map(r => r.length));

  // Single value column (no labels column)
  if (numCols === 1) {
    return {
      labels: dataRows.map((_, i) => String(i + 1)),
      series: [{
        name: headers?.[0] ?? "Value",
        values: dataRows.map(r => parseFloat(r[0].replace(/[^0-9.-]/g, "")) || 0),
      }],
    };
  }

  // Normal: first column = labels, remaining columns = series
  const labels = dataRows.map(r => r[0] || "");
  const seriesCount = numCols - 1;

  const series = Array.from({ length: seriesCount }, (_, i) => ({
    name: headers
      ? (headers[i + 1] || `Series ${i + 1}`)
      : (seriesCount === 1 ? "Value" : `Series ${i + 1}`),
    values: dataRows.map(r => {
      const val = r[i + 1] ?? "";
      return parseFloat(val.replace(/[^0-9.-]/g, "")) || 0;
    }),
  }));

  return { labels, series };
}
