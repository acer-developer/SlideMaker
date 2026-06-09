import type { ChartBlock } from "./types";

/**
 * generatePPT
 *
 * Flow:
 *  1. POST all block data (dataRaw + chartType) to the backend /api/generate-ppt.
 *  2. Backend parses data with parseCSV(), calls AI → gets a complete slide spec JSON.
 *  3. Backend renders native pptxgenjs charts via slide.addChart() — fully editable.
 *  4. Frontend receives the binary and triggers a browser download.
 *
 * Why backend?
 *  - AI (via your API keys) designs every element: title, KPI, annotations, layout.
 *  - The output is a proper editable PPTX — real text boxes, shapes, native charts.
 *  - No fragile client-side canvas capture; rendering is deterministic template-based.
 */
function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined" && !window.location.hostname.includes("localhost")) {
    return "https://slidemaker-backend.onrender.com";
  }
  return "http://localhost:4000";
}

export async function generatePPT(blocks: ChartBlock[]): Promise<void> {
  const apiUrl     = getApiUrl();
  const provider   = localStorage.getItem("slidemaker_provider") || "openrouter";
  const useDefault = localStorage.getItem("slidemaker_use_default") === "true";
  const apiKey     = useDefault ? undefined : (localStorage.getItem(`slidemaker_${provider}_key`) || undefined);

  // ── 1. Call backend → AI designs spec → renders PPTX (native charts) ──────
  // 90-second timeout — AI on free-tier can take 60-90s on first call
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 90_000);

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/api/generate-ppt`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks,  // dataRaw + chartType sent directly; backend parses and renders natively
        ...(apiKey ? { apiKey, provider } : {}),
      }),
      signal: controller.signal,
    });
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("PPT generation timed out after 90 seconds — AI is busy, please try again.");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    // Backend returns JSON error
    let msg = "PPT generation failed";
    try { msg = (await res.json()).error ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }

  // ── 2. Trigger browser download ────────────────────────────────────────────
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
