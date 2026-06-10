import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";

export const maxDuration = 60;

// Use require() with static literal paths so webpack bundles them correctly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderPPT } = require("../../../lib/pptRenderer.js") as { renderPPT: (P: typeof PptxGenJS, spec: unknown, data: unknown[]) => Promise<Buffer> };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseCSV }  = require("../../../lib/parseData.server.js") as { parseCSV: (raw: string) => unknown };

// ── Default keys ──────────────────────────────────────────────────────────────
const DEFAULT_OR = process.env.OPENROUTER_DEFAULT_KEY || process.env.OPENROUTER_API_KEY || "";
const DEFAULT_NV = process.env.NVIDIA_DEFAULT_KEY     || process.env.NVIDIA_API_KEY     || "";

// ── Raw AI callers ────────────────────────────────────────────────────────────
async function callOpenRouterRaw(key: string, prompt: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://slidemaker.app" },
    body: JSON.stringify({ model: "meta-llama/llama-3.3-70b-instruct:free", messages: [{ role: "user", content: prompt }], max_tokens: 1200, temperature: 0.2 }),
    signal: AbortSignal.timeout(55000),
  } as RequestInit);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "OpenRouter error");
  return data.choices[0].message.content;
}

async function callNvidiaRaw(key: string, prompt: string): Promise<string> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "meta/llama-3.1-70b-instruct", messages: [{ role: "user", content: prompt }], max_tokens: 1200, temperature: 0.2 }),
    signal: AbortSignal.timeout(55000),
  } as RequestInit);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? "NVIDIA NIM error");
  return data.choices[0].message.content;
}

// ── Spec parser ───────────────────────────────────────────────────────────────
function parsePPTSpec(text: string) {
  const clean = (s: string) => (s || "").replace(/[—–]/g, "-").trim();
  const ci    = (s: string) => (s || "").trim().slice(0, 4);
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]);
      return {
        layout: p.layout || "single",
        slideTitle: clean(p.slideTitle),
        slideSubtitle: clean(p.slideSubtitle),
        exhibits: (p.exhibits || []).map((e: Record<string,unknown>) => ({
          exhibitNum: e.exhibitNum || 1,
          title: clean(e.title as string),
          chartIndex: typeof e.chartIndex === "number" ? e.chartIndex : 0,
          chartType: clean((e.chartType as string) || "bar"),
          kpi: e.kpi ? { icon: ci((e.kpi as Record<string,string>).icon || "📊"), title: clean((e.kpi as Record<string,string>).title), keyMetric: clean((e.kpi as Record<string,string>).keyMetric), description: clean((e.kpi as Record<string,string>).description) } : null,
          annotations: ((e.annotations || []) as Record<string,string>[]).slice(0,3).map(a => ({ period: clean(a.period), label: clean(a.label), description: clean(a.description), icon: ci(a.icon||"") })),
          insights: ((e.insights || []) as string[]).map(clean),
          source: clean(e.source as string),
        })),
        takeaways: (p.takeaways || []).map(clean),
      };
    }
  } catch { /* fall through to default */ }
  return { layout:"single", slideTitle:"DATA ANALYSIS", slideSubtitle:"", exhibits:[{exhibitNum:1,title:"Chart Analysis",chartIndex:0,kpi:null,annotations:[],insights:[],source:""}], takeaways:[] };
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPPTPrompt(blocks: Record<string,unknown>[]) {
  const count = blocks.length;
  const layoutMap: Record<number,string> = { 1:"single", 2:"stacked-2", 3:"grid-3", 4:"grid-4" };
  const layout = layoutMap[Math.min(count, 4)] || "single";

  const chartDesc = blocks.map((b, i) => {
    const userType = (b.chartType as string || "").trim();
    const typeHint = userType && userType !== "auto"
      ? `  User-selected type: ${userType} (use this unless data clearly suits another)`
      : `  User-selected type: none — YOU must choose the best chart type for this data`;
    const lines = [
      `CHART ${i+1}:`,
      `  Context: ${b.context||""}`,
      typeHint,
      `  Data:\n${((b.dataRaw as string)||"").slice(0,500)}`,
    ];
    if (b.source) lines.push(`  Source: ${b.source}`);
    return lines.join("\n");
  }).join("\n\n---\n\n");

  const kpiBlock = layout === "single" || layout === "stacked-2"
    ? `      "kpi": { "icon":"emoji", "title":"2-5 WORD NOUN PHRASE", "keyMetric":"One sentence with data. Max 18 words.", "description":"2-3 consulting sentences." },
      "annotations": [
        { "period":"first range", "label":"2-3 word phase", "description":"15-20 words with number", "icon":"emoji" },
        { "period":"second", "label":"phase", "description":"insight with number", "icon":"emoji" },
        { "period":"third", "label":"phase", "description":"insight with number", "icon":"emoji" }
      ],`
    : `      "insights": ["15-20 word insight 1 for this chart", "insight 2"],`;

  return `BCG slide spec generator. Return ONLY valid JSON, NO markdown.

LAYOUT: "${layout}" | CHARTS: ${count}

${chartDesc}

CHART TYPE OPTIONS (pick the best fit per chart):
- "bar"            : comparing categories, rankings, discrete groups
- "line"           : trends over time, continuous data, multiple series over time
- "area"           : cumulative trends, volume over time, stacked growth
- "pie"            : part-of-whole with ≤6 slices, proportions/share
- "doughnut"       : same as pie but with a hole — use for market share, composition
- "scatter"        : correlation between two variables, distribution
- "horizontal-bar" : long category labels, many categories, rankings

{
  "layout": "${layout}",
  "slideTitle": "ALL CAPS MAX 8 WORDS",
  "slideSubtitle": "1-2 sentences. No em dashes.",
  "exhibits": [{
    "exhibitNum": 1, "title": "Descriptive title", "chartIndex": 0,
    "chartType": "bar",
${kpiBlock}
    "source": ""
  }${count > 1 ? ` (repeat for all ${count} charts with correct chartIndex and chartType)` : ""}],
  "takeaways": ["3-5 bullets. Use [[key terms]] in double brackets. 15-25 words each."]
}

RULES: No em dashes. 3 annotations per exhibit. kpi.title is a noun phrase only. chartType must be one of the options above.`;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { blocks, apiKey, provider } = await req.json();
  if (!blocks || !Array.isArray(blocks) || !blocks.length)
    return NextResponse.json({ error: "blocks array is required" }, { status: 400 });

  const prompt = buildPPTPrompt(blocks as Record<string,unknown>[]);

  // NVIDIA first — OpenRouter free tier is frequently rate-limited (429)
  const attempts: Array<() => Promise<string>> = [
    ...(apiKey && provider === "nvidia"     ? [() => callNvidiaRaw(apiKey as string, prompt)]                            : []),
    ...(apiKey && provider === "openrouter" ? [() => callOpenRouterRaw(apiKey as string, prompt)]                        : []),
    ...(process.env.NVIDIA_API_KEY          ? [() => callNvidiaRaw(process.env.NVIDIA_API_KEY!, prompt)]                 : []),
    ...(process.env.OPENROUTER_API_KEY      ? [() => callOpenRouterRaw(process.env.OPENROUTER_API_KEY!, prompt)]         : []),
    () => callNvidiaRaw(DEFAULT_NV, prompt),
    () => callOpenRouterRaw(DEFAULT_OR, prompt),
  ];

  const pptErrors: string[] = [];
  let rawText: string | null = null;
  for (const fn of attempts) {
    try { rawText = await fn(); if (rawText) break; }
    catch (e) {
      const msg = (e as Error).message;
      pptErrors.push(msg);
      console.error("PPT AI attempt failed:", msg);
    }
  }
  if (!rawText)
    return NextResponse.json({ error: "AI generation unavailable — all providers failed.", details: pptErrors }, { status: 503 });

  const spec = parsePPTSpec(rawText);
  console.log("PPT spec — layout:", spec.layout, "| exhibits:", spec.exhibits.length);

  const chartDataArray = (blocks as Record<string,unknown>[]).map(b => ({
    parsed:    parseCSV((b.dataRaw as string) || ""),
    chartType: (b.chartType as string) || null,
  }));

  try {
    const buffer = await renderPPT(PptxGenJS, spec, chartDataArray);
    return new Response(buffer as Buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": 'attachment; filename="slidemaker-slide.pptx"',
      },
    });
  } catch (e) {
    console.error("PPT render failed:", (e as Error).message);
    return NextResponse.json({ error: "PPT render failed: " + (e as Error).message }, { status: 500 });
  }
}
