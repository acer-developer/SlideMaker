import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";

export const maxDuration = 60;

// Use static require() so webpack bundles correctly (createRequire breaks in CJS output)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderPPT } = require("../../../lib/pptRenderer.js") as {
  renderPPT: (P: typeof PptxGenJS, spec: unknown, chartDataArray: unknown[]) => Promise<Buffer>
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseCSV } = require("../../../lib/parseData.server.js") as {
  parseCSV: (raw: string) => unknown
};

/**
 * POST /api/render-ppt
 * Pure render — NO AI call. Uses pre-built spec + parsed chart data.
 * Renders native pptxgenjs charts (fully editable in PowerPoint).
 */
export async function POST(req: NextRequest) {
  const { spec, blocks } = await req.json();

  if (!spec || !blocks || !Array.isArray(blocks))
    return NextResponse.json({ error: "spec and blocks are required" }, { status: 400 });

  // Parse CSV → { labels, series } for each block — used by addChart()
  const chartDataArray = (blocks as { dataRaw: string; chartType: string | null }[]).map(b => ({
    parsed:    parseCSV(b.dataRaw || ""),
    chartType: b.chartType || null,
  }));

  try {
    const buffer = await renderPPT(PptxGenJS, spec, chartDataArray);
    return new Response(buffer as Buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": 'attachment; filename="slidemaker-slide.pptx"',
      },
    });
  } catch (e) {
    console.error("PPT render failed:", (e as Error).message);
    return NextResponse.json({ error: "PPT render failed: " + (e as Error).message }, { status: 500 });
  }
}
