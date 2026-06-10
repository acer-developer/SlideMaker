import type { ChartBlock } from "./types";

/**
 * generatePPT
 *
 * Flow:
 *  1. Build slide spec from blocks state (kpi, insights, annotations already
 *     generated in step 1 — NO second AI call).
 *  2. POST spec + raw chart data to /api/render-ppt.
 *  3. Server renders native pptxgenjs charts (addChart) so they are fully
 *     editable in PowerPoint. Layout mirrors SlideCanvas exactly.
 *  4. Browser downloads the binary.
 */
export async function generatePPT(blocks: ChartBlock[]): Promise<void> {
  // ── 1. Build spec from already-generated insights ──────────────────────
  const spec = buildSpecFromBlocks(blocks);

  // ── 2. POST to render-ppt (pure render, no AI) ─────────────────────────
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 60_000);

  let res: Response;
  try {
    res = await fetch("/api/render-ppt", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spec,
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

  // ── 3. Trigger browser download ────────────────────────────────────────
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

/* ─── Build slide spec from blocks (uses AI insights from step 1) ────────── */
function buildSpecFromBlocks(blocks: ChartBlock[]) {
  const count    = Math.min(blocks.length, 4);
  const layoutMap: Record<number, string> = {
    1: "single", 2: "stacked-2", 3: "grid-3", 4: "grid-4",
  };

  const first         = blocks[0];
  const slideTitle    = (first?.context || "Data Analysis")
    .split(" ").slice(0, 7).join(" ")
    .toUpperCase();
  const slideSubtitle = first?.slideSubtitle || "";

  const exhibits = blocks.slice(0, 4).map((b, i) => ({
    exhibitNum:  i + 1,
    title:       b.context.slice(0, 72) || `Chart ${i + 1}`,
    chartIndex:  i,
    chartType:   b.chartType,
    kpi: b.kpiTitle ? {
      icon:        b.kpiIcon        || "📊",
      title:       b.kpiTitle,
      keyMetric:   b.kpiSubtitle    || "",
      description: b.kpiDescription || "",
    } : null,
    annotations: (b.annotations || []).slice(0, 3),
    insights:    (b.insights    || []).slice(0, 4),
    source:      b.source || "",
  }));

  // Takeaways: first 2 insights from each block, up to 4 total
  const takeaways = blocks
    .flatMap(b => (b.insights || []).slice(0, 2))
    .slice(0, 4);

  return {
    layout: layoutMap[count] || "single",
    slideTitle,
    slideSubtitle,
    exhibits,
    takeaways,
  };
}
