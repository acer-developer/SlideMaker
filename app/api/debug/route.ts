/**
 * /api/debug — env var check + live AI connectivity test.
 * Visit to see exactly which provider is failing and why.
 */
export async function GET() {
  const OR = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_DEFAULT_KEY || "";
  const NV = process.env.NVIDIA_API_KEY     || process.env.NVIDIA_DEFAULT_KEY     || "";

  // ── Test OpenRouter ──────────────────────────────────────────────────────────
  let or_result = "(not tested — key empty)";
  if (OR) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OR}`, "Content-Type": "application/json", "HTTP-Referer": "https://slidemaker.app" },
        body: JSON.stringify({ model: "meta-llama/llama-3.3-70b-instruct:free", messages: [{ role: "user", content: "Reply with one word: OK" }], max_tokens: 5 }),
        signal: AbortSignal.timeout(20000),
      } as RequestInit);
      const d = await r.json();
      or_result = r.ok ? `✓ OK — "${d.choices?.[0]?.message?.content}"` : `✗ HTTP ${r.status}: ${JSON.stringify(d).slice(0, 200)}`;
    } catch (e) { or_result = `✗ Exception: ${(e as Error).message}`; }
  }

  // ── Test NVIDIA ──────────────────────────────────────────────────────────────
  let nv_result = "(not tested — key empty)";
  if (NV) {
    try {
      const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${NV}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "meta/llama-3.1-70b-instruct", messages: [{ role: "user", content: "Reply with one word: OK" }], max_tokens: 5 }),
        signal: AbortSignal.timeout(20000),
      } as RequestInit);
      const d = await r.json();
      nv_result = r.ok ? `✓ OK — "${d.choices?.[0]?.message?.content}"` : `✗ HTTP ${r.status}: ${JSON.stringify(d).slice(0, 200)}`;
    } catch (e) { nv_result = `✗ Exception: ${(e as Error).message}`; }
  }

  return Response.json({
    keys: {
      OPENROUTER_set:  OR.length > 0,
      NVIDIA_set:      NV.length > 0,
      OPENROUTER_hint: OR ? `${OR.slice(0, 10)}...` : "(empty)",
      NVIDIA_hint:     NV ? `${NV.slice(0, 10)}...` : "(empty)",
    },
    live_tests: {
      openrouter: or_result,
      nvidia:     nv_result,
    },
    node_env: process.env.NODE_ENV,
    node_version: process.version,
  });
}
