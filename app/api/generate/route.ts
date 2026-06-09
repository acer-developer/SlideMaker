import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for /api/generate.
 *
 * Why: NEXT_PUBLIC_API_URL is a build-time env var — if it's not set on Vercel
 * the browser ends up calling localhost:4000 (which fails in production).
 * This proxy runs server-side, so BACKEND_URL is a runtime secret, always correct.
 */
export async function POST(req: NextRequest) {
  const backendUrl =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000";

  try {
    const body = await req.text();
    const upstream = await fetch(`${backendUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // @ts-expect-error -- Node 18 fetch supports signal
      signal: AbortSignal.timeout(60_000),
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Proxy error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
