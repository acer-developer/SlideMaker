/**
 * /api/debug — env var presence check (no values exposed).
 * Visit this URL to confirm keys are loaded on the server.
 */
export async function GET() {
  const OR  = process.env.OPENROUTER_API_KEY    || process.env.OPENROUTER_DEFAULT_KEY || "";
  const NV  = process.env.NVIDIA_API_KEY         || process.env.NVIDIA_DEFAULT_KEY     || "";
  return Response.json({
    OPENROUTER_set: OR.length > 0,
    NVIDIA_set:     NV.length > 0,
    OPENROUTER_hint: OR ? `${OR.slice(0, 8)}...` : "(empty)",
    NVIDIA_hint:     NV ? `${NV.slice(0, 8)}...` : "(empty)",
    node_env: process.env.NODE_ENV,
  });
}
