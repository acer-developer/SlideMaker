import type { ChartBlock } from "./types";

/**
 * generatePPT
 *
 * Flow:
 *  1. Capture every chart's canvas as a base64 PNG (frontend).
 *  2. POST all block data + chart images to the backend /api/generate-ppt.
 *  3. Backend calls AI → gets a complete slide spec JSON.
 *  4. Backend renders the spec into a real editable PPTX (pptxgenjs, server-side).
 *  5. Frontend receives the binary and triggers a browser download.
 *
 * Why backend?
 *  - AI (via your API keys) designs every element: title, KPI, annotations, layout.
 *  - The output is a proper editable PPTX — real text boxes, shapes, chart images.
 *  - No fragile client-side layout code; rendering is deterministic template-based.
 */
export async function generatePPT(blocks: ChartBlock[]): Promise<void> {
  const apiUrl   = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const provider = localStorage.getItem("slidemaker_provider") || "openrouter";
  const apiKey   = localStorage.getItem(`slidemaker_${provider}_key`) || undefined;

  // ── 1. Capture chart canvas images ────────────────────────────────────────
  const blocksWithImages = blocks.map((block) => {
    const el = document.getElementById(`chart-${block.id}`) as HTMLCanvasElement | null;
    const chartImage =
      el?.tagName === "CANVAS" ? el.toDataURL("image/png") : null;
    return { ...block, chartImage };
  });

  // ── 2. Call backend → AI designs spec → renders PPTX ─────────────────────
  const res = await fetch(`${apiUrl}/api/generate-ppt`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: blocksWithImages,
      ...(apiKey ? { apiKey, provider } : {}),
    }),
  });

  if (!res.ok) {
    // Backend returns JSON error
    let msg = "PPT generation failed";
    try { msg = (await res.json()).error ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }

  // ── 3. Trigger browser download ────────────────────────────────────────────
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
