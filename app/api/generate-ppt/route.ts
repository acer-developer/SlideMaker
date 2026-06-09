import { NextRequest, NextResponse } from "next/server";
import { createRequire } from "module";
import path from "path";
import PptxGenJS from "pptxgenjs";

export const maxDuration = 60; // Vercel cap; Render has no limit

// Load CommonJS renderer + parser from lib/
const _require = createRequire(import.meta.url);
const { renderPPT } = _require(path.join(process.cwd(), "lib/pptRenderer.js"));
const { parseCSV }  = _require(path.join(process.cwd(), "lib/parseData.server.js"));

// ── Default keys ──────────────────────────────────────────────────────────────
const DEFAULT_OR = process.env.OPENROUTER_DEFAULT_KEY || process.env.OPENROUTER_API_KEY || "";
const DEFAULT_NV = process.env.NVIDIA_DEFAULT_KEY     || process.env.NVIDIA_API_KEY     || "";

// ── Raw AI callers (return raw text — slide spec must not be parsed) ──────────
async function callOpenRouterRaw(key: string, prompt: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://slidemaker.app" },
    body: JSON.stringify({ model: "meta-llama/llama-3.3-70b-instruct:free", messages: [{ role: "user", content: prompt }], max_tokens: 1200, temperature: 0.2 }),
    // @ts-expect-error Node 18+
    signal: AbortSignal.timeout(55000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "OpenRouter error");
  return data.choices[0].message.content;
}

async function callNvidiaRaw(key: string, prompt: string): Promise<string> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "meta/llama-3.1-70b-instruct", messages: [{ role: "user", content: prompt }], max_tokens: 1200, temperature: 0.2 }),
    // @ts-expect-error Node 18+
    signal: AbortSignal.timeout(55000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? "NVIDIA NIM error");
  return data.choices[0].message.content;
}

// ── Spec parser ───────────────────────────────────────────────────────────────
function parsePPTSpec(text: string) {
  const clean = (s: string) => (s || "").replace(/[—–]/g, "-").trim();
  const cleanIcon = (s: string) => (s || "").trim().slice(0, 4);
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]);
      return {
        layout:        p.layout        || "single",
        slideTitle:    clean(p.slideTitle),
        slideSubtitle: clean(p.slideSubtitle),
        exhibits: (p.exhibits || []).map((e: Record<string, unknown>) => ({
          exhibitNum:  e.exhibitNum  || 1,
          title:       clean(e.title as string),
          chartIndex:  typeof e.chartIndex === "number" ? e.chartIndex : 0,
          kpi: e.kpi ? {
            icon:        cleanIcon((e.kpi as Record<string,string>).icon || "📊"),
            title:       clean((e.kpi as Record<string,string>).title),
            keyMetric:   clean((e.kpi as Record<string,string>).keyMetric),
            description: clean((e.kpi as Record<string,string>).description),
          } : null,
          annotations: ((e.annotations || []) as Record<string,string>[]).slice(0, 3).map(a => ({
            period: clean(a.period), label: clean(a.label), description: clean(a.description), icon: cleanIcon(a.icon || ""),
          })),
          insights: ((e.insights || []) as string[]).map(clean),
          source:   clean(e.source as string),
        })),
        takeaways: (p.takeaways || []).map(clean),
      };
    }
  } catch (e) { console.error("PPT spec parse failed:", (e as Error).message); }
  return {
    layout: "single", slideTitle: "DATA ANALYSIS", slideSubtitle: "",
    exhibits: [{ exhibitNum: 1, title: "Chart Analysis", chartIndex: 0, kpi: null, annotations: [], insights: [], source: "" }],
    takeaways: [],
  };
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPPTPrompt(blocks: Record<string, unknown>[]) {
  const count = blocks.length;
  const layoutMap: Record<number, string> = { 1: "single", 2: "stacked-2", 3: "grid-3", 4: "grid-4" };
  const layout = layoutMap[Math.min(count, 4)] || "single";

  const chartDesc = blocks.map((b, i) => {
    const lines = [
      `CHART ${i + 1}:`,
      `  Context: ${b.context || ""}`,
      `  Chart type: ${b.chartType || "auto"}`,
      `  Data:\n${((b.dataRaw as string) || "").slice(0, 500)}`,
    ];
    if (b.kpiTitle)       lines.push(`  KPI title: ${b.kpiTitle}`);
    if (b.kpiSubtitle)    lines.push(`  KPI metric: ${b.kpiSubtitle}`);
    if ((b.insights as unknown[])?.length) lines.push(`  Insights:\n${(b.insights as string[]).map((s, j) => `    ${j + 1}. ${s}`).join("\n")}`);
    if ((b.annotations as unknown[])?.length) lines.push(`  Annotations: ${JSON.stringify(b.annotations)}`);
    if (b.source)         lines.push(`  Source: ${b.source}`);
    return lines.join("\n");
  }).join("\n\n---\n\n");

  const kpiBlock = layout === "single" || layout === "stacked-2"
    ? `      "kpi": { "icon": "emoji", "title": "2-5 WORD NOUN PHRASE", "keyMetric": "One data-backed sentence. Max 18 words.", "description": "2-3 consulting sentences. No em dashes." },
      "annotations": [
        { "period": "first range", "label": "2-3 word phase", "description": "15-20 words with number", "icon": "emoji" },
        { "period": "second range", "label": "phase", "description": "insight with number", "icon": "emoji" },
        { "period": "third range", "label": "phase", "description": "insight with number", "icon": "emoji" }
      ],`
    : `      "insights": ["insight 1 for this chart, 15-20 words", "insight 2"],`;

  return `You are a BCG senior presentation designer. Generate a complete professional A4 PowerPoint slide specification.

LAYOUT: "${layout}" | CHARTS: ${count}

${chartDesc}

Return ONLY valid JSON, NO markdown fences:

{
  "layout": "${layout}",
  "slideTitle": "ALL CAPS MAX 8 WORDS",
  "slideSubtitle": "1-2 sentences 20-35 words. No em dashes.",
  "exhibits": [
    {
      "exhibitNum": 1,
      "title": "Descriptive title with timeframe",
      "chartIndex": 0,
${kpiBlock}
      "source": "Source if mentioned else empty string"
    }${count > 1 ? ` (repeat for all ${count} charts)` : ""}
  ],
  "takeaways": [
    "Insight 1 with [[key term]] in double brackets. 15-25 words.",
    "Insight 2 with [[key term]].",
    "Insight 3 with [[key term]].",
    "Insight 4 forward-looking."
  ]
}

RULES: No em/en dashes. Exactly 3 annotations. takeaways: 3-5 items total. kpi.title is a noun phrase only.`;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { blocks, apiKey, provider } = await req.json();
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0)
    return NextResponse.json({ error: "blocks array is required" }, { status: 400 });

  const prompt = buildPPTPrompt(blocks);

  const attempts: Array<() => Promise<string>> = [
    ...(apiKey && provider === "openrouter" ? [() => callOpenRouterRaw(apiKey, prompt)] : []),
    ...(apiKey && provider === "nvidia"     ? [() => callNvidiaRaw(apiKey, prompt)]     : []),
    ...(process.env.OPENROUTER_API_KEY ? [() => callOpenRouterRaw(process.env.OPENROUTER_API_KEY!, prompt)] : []),
    ...(process.env.NVIDIA_API_KEY     ? [() => callNvidiaRaw(process.env.NVIDIA_API_KEY!, prompt)]         : []),
    () => callOpenRouterRaw(DEFAULT_OR, prompt),
    () => callNvidiaRaw(DEFAULT_NV, prompt),
  ];

  let rawText: string | null = null;
  for (const attempt of attempts) {
    try { rawText = await attempt(); if (rawText) break; }
    catch (e) { console.error("PPT AI attempt failed:", (e as Error).message); }
  }
  if (!rawText)
    return NextResponse.json({ error: "AI generation unavailable — all providers failed." }, { status: 503 });

  const spec = parsePPTSpec(rawText);
  console.log("PPT spec — layout:", spec.layout, "| exhibits:", spec.exhibits.length);

  const chartDataArray = blocks.map((b: Record<string, unknown>) => ({
    parsed:    parseCSV((b.dataRaw as string) || ""),
    chartType: (b.chartType as string) || null,
  }));

  try {
    const buffer = await renderPPT(PptxGenJS, spec, chartDataArray);
    return new Response(buffer, {
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
