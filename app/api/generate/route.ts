import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel cap; Render has no limit

// ── Default keys (set in Render / Vercel env dashboard) ──────────────────────
const DEFAULT_OR   = process.env.OPENROUTER_DEFAULT_KEY || process.env.OPENROUTER_API_KEY || "";
const DEFAULT_NV   = process.env.NVIDIA_DEFAULT_KEY     || process.env.NVIDIA_API_KEY     || "";

// ── AI callers ────────────────────────────────────────────────────────────────
async function callOpenRouter(key: string, prompt: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://slidemaker.app" },
    body: JSON.stringify({ model: "meta-llama/llama-3.3-70b-instruct:free", messages: [{ role: "user", content: prompt }], max_tokens: 1000, temperature: 0.25 }),
    // @ts-expect-error Node 18+
    signal: AbortSignal.timeout(50000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "OpenRouter error");
  return parseResponse(data.choices[0].message.content);
}

async function callNvidia(key: string, prompt: string) {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "meta/llama-3.1-70b-instruct", messages: [{ role: "user", content: prompt }], max_tokens: 1000, temperature: 0.25 }),
    // @ts-expect-error Node 18+
    signal: AbortSignal.timeout(50000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? "NVIDIA NIM error");
  return parseResponse(data.choices[0].message.content);
}

// ── Response parser ───────────────────────────────────────────────────────────
function parseResponse(text: string) {
  const clean = (s: string) => (s || "").replace(/[—–]/g, "-").trim();
  const cleanIcon = (s: string) => (s || "").trim().slice(0, 4);
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]);
      return {
        insights: (p.insights || []).map(clean).filter((s: string) => s.length > 8).slice(0, 5),
        kpiTitle: clean(p.kpiTitle), kpiSubtitle: clean(p.kpiSubtitle),
        kpiDescription: clean(p.kpiDescription), kpiIcon: cleanIcon(p.kpiIcon),
        source: clean(p.source), slideSubtitle: clean(p.slideSubtitle),
        annotations: (p.annotations || []).slice(0, 3).map((a: Record<string, string>) => ({
          period: clean(a.period), label: clean(a.label), description: clean(a.description), icon: cleanIcon(a.icon),
        })),
      };
    }
  } catch { /* fall through to text parsing */ }
  return {
    insights: text.split("\n").map(l => clean(l.replace(/^[-*\d.]+\s*/, ""))).filter(l => l.length > 8).slice(0, 5),
    kpiTitle: "", kpiSubtitle: "", kpiDescription: "", kpiIcon: "", source: "", slideSubtitle: "", annotations: [],
  };
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(dataRaw: string, context: string, instructions: string, chartType: string) {
  const chartHint = chartType ? `\nVisualization type: ${chartType.replace(/-/g, " ")} chart\n` : "";
  const instrBlock = instructions?.trim()
    ? `\n==============================\nMANDATORY CHART INSTRUCTIONS:\n${instructions}\n==============================\n`
    : "";
  return `You are a senior research analyst at BCG/McKinsey. Analyze the data and return structured JSON for a professional research slide.
${chartHint}
Data:
${dataRaw}

Context: ${context}
${instrBlock}
Return ONLY valid JSON with no markdown fences:

{
  "slideSubtitle": "1-2 sentences (20-30 words) capturing the macro story",
  "kpiTitle": "2-4 word headline NOUN PHRASE (NOT a sentence). Max 5 words.",
  "kpiSubtitle": "One data-backed sentence: key metric + exact magnitude + timeframe. Max 18 words.",
  "kpiDescription": "2-3 consulting-grade sentences. No em dashes.",
  "kpiIcon": "Single most relevant emoji",
  "source": "Data source name ONLY if explicitly mentioned, else empty string",
  "annotations": [
    { "period": "first time range from data", "label": "2-4 word phase", "description": "15-20 words with number", "icon": "emoji" },
    { "period": "second range", "label": "phase", "description": "insight with number", "icon": "emoji" },
    { "period": "third range", "label": "phase", "description": "insight with number", "icon": "emoji" }
  ],
  "insights": [
    "Insight 1 with [[key term]] in double brackets. 15-25 words.",
    "Insight 2 with [[key term]].",
    "Insight 3 with [[key term]].",
    "Insight 4 with [[key term]].",
    "Insight 5 forward-looking with [[key term]]."
  ]
}

RULES: No em/en dashes. All numbers from actual data only. Wrap 1-3 KEY TERMS per insight in [[double brackets]].`;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { dataRaw, context, instructions, chartType, apiKey, provider } = await req.json();
  if (!dataRaw || !context)
    return NextResponse.json({ error: "dataRaw and context are required" }, { status: 400 });

  const prompt = buildPrompt(dataRaw, context, instructions, chartType);

  const attempts: Array<() => Promise<unknown>> = [
    ...(apiKey && provider === "openrouter" ? [() => callOpenRouter(apiKey, prompt)] : []),
    ...(apiKey && provider === "nvidia"     ? [() => callNvidia(apiKey, prompt)]     : []),
    ...(process.env.OPENROUTER_API_KEY ? [() => callOpenRouter(process.env.OPENROUTER_API_KEY!, prompt)] : []),
    ...(process.env.NVIDIA_API_KEY     ? [() => callNvidia(process.env.NVIDIA_API_KEY!, prompt)]         : []),
    () => callOpenRouter(DEFAULT_OR, prompt),
    () => callNvidia(DEFAULT_NV, prompt),
  ];

  for (const attempt of attempts) {
    try { return NextResponse.json(await attempt()); }
    catch (e) { console.error("AI attempt failed:", (e as Error).message); }
  }

  return NextResponse.json({ error: "AI generation unavailable — all providers failed." }, { status: 503 });
}
