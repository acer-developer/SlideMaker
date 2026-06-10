import type { ChartBlock } from "./types";

/**
 * generatePPT
 *
 * New flow (preview = download):
 *  1. Capture Chart.js canvas images directly from the SlideCanvas (id="slide-canvas-root").
 *     These are the EXACT pixels the user sees in the preview — no re-rendering.
 *  2. Build a slide spec from the already-generated blocks state (kpi, annotations,
 *     insights from step-1 AI) — NO second AI call.
 *  3. POST spec + captured images to /api/render-ppt.
 *  4. Server embeds the chart images into a pptxgenjs slide that matches SlideCanvas layout.
 *  5. Browser downloads the binary.
 */
export async function generatePPT(blocks: ChartBlock[]): Promise<void> {
  // ── 1. Capture chart canvases from the slide preview ────────────────────
  const chartImages = captureSlideChartImages();

  // ── 2. Build spec from blocks (uses insights already generated in step 1) ─
  const spec = buildSpecFromBlocks(blocks);

  // ── 3. POST to render-ppt — pure render, no AI ───────────────────────────
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 60_000); // 60s — render only, no AI

  let res: Response;
  try {
    res = await fetch("/api/render-ppt", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spec,
        chartImages,
        blocks: blocks.map(b => ({ dataRaw: b.dataRaw, chartType: b.chartType })),
      }),
      signal: controller.signal,
    });
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("PPT generation timed out — please try again.");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let msg = "PPT generation failed";
    try { msg = (await res.json()).error ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }

  // ── 4. Trigger download ───────────────────────────────────────────────────
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "slidemaker-slide.pptx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─── Capture Chart.js canvas images from SlideCanvas ───────────────────── */
function captureSlideChartImages(): string[] {
  const root = document.getElementById("slide-canvas-root");
  if (!root) return [];
  const canvases = root.querySelectorAll("canvas");
  return Array.from(canvases).map(c => {
    try { return (c as HTMLCanvasElement).toDataURL("image/png"); }
    catch { return ""; }
  }).filter(Boolean);
}

/* ─── Build slide spec from blocks state ────────────────────────────────── */
function buildSpecFromBlocks(blocks: ChartBlock[]) {
  const count    = Math.min(blocks.length, 4);
  const layoutMap: Record<number, string> = {
    1: "single", 2: "stacked-2", 3: "grid-3", 4: "grid-4",
  };
  const layout = layoutMap[count] || "single";

  // Use first block's slideSubtitle + context for header
  const first = blocks[0];
  const slideTitle = (first?.context || "Data Analysis")
    .split(" ").slice(0, 7).join(" ")
    .toUpperCase();
  const slideSubtitle = first?.slideSubtitle || "";

  const exhibits = blocks.slice(0, 4).map((b, i) => ({
    exhibitNum: i + 1,
    title:      b.context.slice(0, 72) || `Chart ${i + 1}`,
    chartIndex: i,
    kpi: b.kpiTitle ? {
      icon:      b.kpiIcon      || "📊",
      title:     b.kpiTitle,
      keyMetric: b.kpiSubtitle  || "",
      description: b.kpiDescription || "",
    } : null,
    annotations: (b.annotations || []).slice(0, 3),
    insights:    (b.insights    || []).slice(0, 4),
    source:      b.source || "",
  }));

  // Key takeaways: first 2 insights from each block, up to 4 total
  const takeaways = blocks
    .flatMap(b => (b.insights || []).slice(0, 2))
    .slice(0, 4);

  return { layout, slideTitle, slideSubtitle, exhibits, takeaways };
}
