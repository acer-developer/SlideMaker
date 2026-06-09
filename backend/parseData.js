/**
 * parseData.js
 * CommonJS port of lib/parseData.ts
 * Parses raw CSV/TSV text into { labels, series } for pptxgenjs chart rendering.
 */

/**
 * @param {string} raw - raw CSV or TSV text
 * @returns {{ labels: string[], series: { name: string, values: number[] }[] }}
 */
function parseCSV(raw) {
  if (!raw || typeof raw !== 'string') return { labels: [], series: [] };

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

module.exports = { parseCSV };
