/**
 * /api/ping — lightweight health check.
 * Used by the client-side keep-alive interval to prevent Render free-tier cold starts.
 * Returns immediately with no heavy work — just proves the server is awake.
 */
export async function GET() {
  return Response.json({ ok: true });
}
