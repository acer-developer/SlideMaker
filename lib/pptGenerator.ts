import type { ChartBlock } from "./types";

/**
 * generatePPT — single AI call flow
 *
 * Flow:
 *  1. POST all block data to /api/generate-ppt
 *  2. AI generates full slide spec (chart types, KPI, annotations, takeaways)
 *  3. Server renders native pptxgenjs charts (addChart) — fully editable
 *  4. Browser downloads the PPTX
 *
 * No preview step. No second AI call.
 */
export async function generatePPT(blocks: ChartBlock[]): Promise<void> {
  const provider   = localStorage.getItem("slidemaker_provider") || "openrouter";
  const useDefault = localStorage.getItem("slidemaker_use_default") === "true";
  const apiKey     = useDefault ? undefined : (localStorage.getItem(`slidemaker_${provider}_key`) || undefined);

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 90_000);

  let res: Response;
  try {
    res = await fetch("/api/generate-ppt", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks,
        ...(apiKey ? { apiKey, provider } : {}),
      }),
      signal: controller.signal,
    });
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("PPT generation timed out after 90s — AI is busy, please try again.");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let msg = "PPT generation failed";
    try {
      const j = await res.json();
      msg = j.error ?? msg;
      if (j.details?.length) msg += `\n\n${j.details.join("\n")}`;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  // Trigger browser download
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
