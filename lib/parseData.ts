export interface ParsedData {
  labels: string[];
  series: { name: string; values: number[] }[];
}

export function parseCSV(raw: string): ParsedData {
  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { labels: [], series: [] };

  const delimiter = raw.includes('\t') ? '\t' : ',';
  const rows = lines.map(l => l.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, '')));
  const headers = rows[0];
  const dataRows = rows.slice(1);
  const labels = dataRows.map(r => r[0] || '');

  const series = headers.slice(1).map((h, i) => ({
    name: h,
    values: dataRows.map(r => {
      const val = r[i + 1];
      if (!val) return 0;
      return parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
    }),
  }));

  return { labels, series };
}
