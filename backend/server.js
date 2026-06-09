const express = require('express');
const cors = require('cors');
require('dotenv').config();
const PptxGenJS = require('pptxgenjs');
const { renderPPT } = require('./pptRenderer');
const { parseCSV } = require('./parseData');

// ── Default API keys — loaded from env vars (set in Render dashboard / .env) ──
// OPENROUTER_DEFAULT_KEY and NVIDIA_DEFAULT_KEY are the shared fallback keys.
// They are intentionally separate from OPENROUTER_API_KEY / NVIDIA_API_KEY so
// server-level keys and default-fallback keys can be rotated independently.
const DEFAULT_OPENROUTER_KEY = process.env.OPENROUTER_DEFAULT_KEY || process.env.OPENROUTER_API_KEY || '';
const DEFAULT_NVIDIA_KEY     = process.env.NVIDIA_DEFAULT_KEY     || process.env.NVIDIA_API_KEY     || '';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '20mb' })); // larger limit for chart images

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'slidemaker-api' }));

app.post('/api/generate', async (req, res) => {
  const { dataRaw, context, instructions, chartType, apiKey, provider } = req.body;
  if (!dataRaw || !context) return res.status(400).json({ error: 'dataRaw and context are required' });

  const prompt = buildPrompt(dataRaw, context, instructions, chartType);

  // ── Key priority: BYOK → env vars → hardcoded defaults ───────────────────
  // If BYOK key fails, fall through to defaults (don't return error — silently retry)
  if (apiKey && provider === 'openrouter') {
    try { return res.json(await callOpenRouter(apiKey, prompt)); }
    catch (e) { console.error('BYOK OpenRouter failed, trying defaults:', e.message); }
  }
  if (apiKey && provider === 'nvidia') {
    try { return res.json(await callNvidia(apiKey, prompt)); }
    catch (e) { console.error('BYOK NVIDIA failed, trying defaults:', e.message); }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try { return res.json(await callOpenRouter(process.env.OPENROUTER_API_KEY, prompt)); }
    catch (e) { console.error('Env OpenRouter failed:', e.message); }
  }
  if (process.env.NVIDIA_API_KEY) {
    try { return res.json(await callNvidia(process.env.NVIDIA_API_KEY, prompt)); }
    catch (e) { console.error('Env NVIDIA failed:', e.message); }
  }

  // Hardcoded defaults (always available)
  try { return res.json(await callOpenRouter(DEFAULT_OPENROUTER_KEY, prompt)); }
  catch (e) { console.error('Default OpenRouter failed:', e.message); }
  try { return res.json(await callNvidia(DEFAULT_NVIDIA_KEY, prompt)); }
  catch (e) { console.error('Default NVIDIA failed:', e.message); }

  res.status(503).json({ error: 'AI generation unavailable — all providers failed.' });
});

function buildPrompt(dataRaw, context, instructions, chartType) {
  const chartHint = chartType
    ? `\nVisualization type: ${chartType.replace(/-/g, ' ')} chart - tailor annotations and insights to this visual type.\n`
    : '';
  const instrBlock = instructions?.trim()
    ? `\n==============================\nMANDATORY CHART INSTRUCTIONS - READ CAREFULLY AND FOLLOW EXACTLY:\n${instructions}\nThese override all defaults. Reflect them in your response.\n==============================\n`
    : '';

  return `You are a senior research analyst at a tier-1 strategy consulting firm (BCG/McKinsey level). Analyze the data below and return a structured JSON response for a professional research slide.
${chartHint}
Data:
${dataRaw}

Context: ${context}
${instrBlock}
Return ONLY valid JSON with no markdown fences, no explanation, no preamble:

{
  "slideSubtitle": "1-2 sentences (20-30 words) capturing the macro story this data reveals - use as a slide-level subheading",
  "kpiTitle": "2-4 word headline NOUN PHRASE (NOT a sentence): e.g. 'Rupee Depreciation', 'Revenue Surge', 'Rate Tightening', 'Cost Escalation'. Max 5 words.",
  "kpiSubtitle": "One data-backed sentence: key metric + exact magnitude + timeframe. E.g. 'USD/INR rose 30% from 73.8 to 95.7 between FY21 and FY26'. Max 18 words.",
  "kpiDescription": "2-3 consulting-grade sentences on business implication. Reference exact data points from the data. No em dashes.",
  "kpiIcon": "Single most contextually relevant emoji - choose from: 💱 (currency/FX), 🏛️ (central bank/monetary policy), 📈 (growth/rising trend), 📉 (decline/falling), ⚡ (energy/power), 🚢 (supply chain/logistics/trade), 💰 (revenue/profit), ⚠️ (risk/volatility), 🏭 (industrial/manufacturing), 🌐 (global/macro), 📊 (general data). Only one emoji.",
  "source": "Data source name ONLY if explicitly mentioned in the context or data (e.g. 'Bloomberg', 'RBI', 'Trading View', 'NSE', 'World Bank'). Empty string if not mentioned.",
  "annotations": [
    {
      "period": "first time range or category group using actual labels from the data (e.g. 'FY21-FY22', 'Q1-Q2 2023', 'Phase 1')",
      "label": "2-4 word phase name (e.g. 'Stability Period', 'Rate Hike Cycle', 'Recovery Phase')",
      "description": "15-20 words with at least one specific number from the data",
      "icon": "one emoji for this phase: 🏦 (stability/normal), 📈 (rising/growth), 📉 (falling/decline), 🔥 (peak/stress), 🔄 (reversal/turning), ⚖️ (balance/equilibrium), 🌊 (volatility), 🏗️ (buildup), 💥 (shock/crisis)"
    },
    {
      "period": "second segment from actual data labels",
      "label": "phase name",
      "description": "specific insight with number",
      "icon": "emoji"
    },
    {
      "period": "third segment from actual data labels",
      "label": "phase name",
      "description": "specific insight with number",
      "icon": "emoji"
    }
  ],
  "insights": [
    "Insight 1: lead with specific % or absolute value. Wrap 1-3 KEY TERMS in [[double brackets]] for teal highlighting. 15-25 words.",
    "Insight 2: different angle. Wrap key terms in [[double brackets]].",
    "Insight 3: wrap key terms in [[double brackets]].",
    "Insight 4: wrap key terms.",
    "Insight 5: forward-looking or comparative takeaway. Wrap key terms."
  ]
}

STRICT RULES:
- ALL numbers must come from the actual data provided - never fabricate or estimate
- No em dashes or en dashes anywhere - use hyphens (-)
- kpiTitle: noun phrase ONLY, NOT a full sentence, max 5 words
- insights: exactly 4-5 items; wrap 1-3 KEY TERMS per insight in [[double brackets]] - these render as teal bold text
- annotations: 3 phases covering the FULL data range; use actual period labels from the data
- kpiIcon and annotation icons: single emoji character each
- source: extract from context/data text only if explicitly mentioned; otherwise return ""`;
}

async function callOpenRouter(key, prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://slidemaker.app',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.25,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'OpenRouter error');
  return parseResponse(data.choices[0].message.content);
}

async function callNvidia(key, prompt) {
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta/llama-3.1-70b-instruct',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.25,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'NVIDIA NIM error');
  return parseResponse(data.choices[0].message.content);
}

function parseResponse(text) {
  const clean = s => (s || '').replace(/[—–]/g, '-').trim();
  const cleanIcon = s => (s || '').trim().slice(0, 4); // emoji can be up to 4 chars

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        insights: (parsed.insights || []).map(clean).filter(s => s.length > 8).slice(0, 5),
        kpiTitle: clean(parsed.kpiTitle),
        kpiSubtitle: clean(parsed.kpiSubtitle),
        kpiDescription: clean(parsed.kpiDescription),
        kpiIcon: cleanIcon(parsed.kpiIcon),
        source: clean(parsed.source),
        slideSubtitle: clean(parsed.slideSubtitle),
        annotations: (parsed.annotations || []).slice(0, 3).map(a => ({
          period: clean(a.period),
          label: clean(a.label),
          description: clean(a.description),
          icon: cleanIcon(a.icon),
        })),
      };
    }
  } catch (e) {
    console.error('JSON parse failed:', e.message, '| raw:', text.slice(0, 300));
  }

  // Fallback: plain text bullet parsing
  return {
    insights: text
      .split('\n')
      .map(l => clean(l.replace(/^[-*\d.]+\s*/, '')))
      .filter(l => l.length > 8)
      .slice(0, 5),
    kpiTitle: '',
    kpiSubtitle: '',
    kpiDescription: '',
    kpiIcon: '',
    source: '',
    slideSubtitle: '',
    annotations: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/generate-ppt
// AI designs the complete slide spec JSON → pptxgenjs renders real editable PPTX.
// NOTE: Uses *raw* API callers (not parseResponse) so the slide-spec JSON is kept intact.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/generate-ppt', async (req, res) => {
  const { blocks, apiKey, provider } = req.body;
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return res.status(400).json({ error: 'blocks array is required' });
  }

  const prompt = buildPPTPrompt(blocks);

  // ── Try all key sources in priority order; stop on first success ──────────
  let rawText = null;
  const attempts = [
    apiKey && provider === 'openrouter' ? () => callOpenRouterRaw(apiKey, prompt)         : null,
    apiKey && provider === 'nvidia'     ? () => callNvidiaRaw(apiKey, prompt)             : null,
    process.env.OPENROUTER_API_KEY      ? () => callOpenRouterRaw(process.env.OPENROUTER_API_KEY, prompt) : null,
    process.env.NVIDIA_API_KEY          ? () => callNvidiaRaw(process.env.NVIDIA_API_KEY, prompt)         : null,
    () => callOpenRouterRaw(DEFAULT_OPENROUTER_KEY, prompt),
    () => callNvidiaRaw(DEFAULT_NVIDIA_KEY, prompt),
  ].filter(Boolean);

  for (const attempt of attempts) {
    try { rawText = await attempt(); if (rawText) break; }
    catch (e) { console.error('PPT AI attempt failed, trying next:', e.message); }
  }

  if (!rawText) {
    return res.status(503).json({ error: 'AI generation unavailable — all providers failed.' });
  }

  // ── Parse slide spec from raw AI text ─────────────────────────────────────
  const spec = parsePPTSpec(rawText);
  console.log('PPT spec generated — layout:', spec.layout, '| exhibits:', spec.exhibits.length, '| takeaways:', spec.takeaways.length);

  // ── Parse chart data for native rendering ─────────────────────────────────
  const chartDataArray = blocks.map(b => ({
    parsed: parseCSV(b.dataRaw || ''),
    chartType: b.chartType || null,
  }));

  // ── Render to PPTX ────────────────────────────────────────────────────────
  try {
    const buffer = await renderPPT(PptxGenJS, spec, chartDataArray);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', 'attachment; filename="slidemaker-slide.pptx"');
    res.send(buffer);
  } catch (e) {
    console.error('PPT render failed:', e.message, e.stack);
    res.status(500).json({ error: 'PPT render failed: ' + e.message });
  }
});

// ── Raw API callers — return raw text (no parseResponse) ─────────────────────
// These are used by /api/generate-ppt so the slide spec JSON is not mangled.
async function callOpenRouterRaw(key, prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://slidemaker.app',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.2,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'OpenRouter error');
  return data.choices[0].message.content;
}

async function callNvidiaRaw(key, prompt) {
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta/llama-3.1-70b-instruct',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.2,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'NVIDIA NIM error');
  return data.choices[0].message.content;
}

// ── Parse slide spec from raw AI text ────────────────────────────────────────
function parsePPTSpec(text) {
  const clean = s => (s || '').replace(/[—–]/g, '-').trim();
  const cleanIcon = s => (s || '').trim().slice(0, 4);
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const p = JSON.parse(jsonMatch[0]);
      return {
        layout:        p.layout        || 'single',
        slideTitle:    clean(p.slideTitle),
        slideSubtitle: clean(p.slideSubtitle),
        exhibits: (p.exhibits || []).map(e => ({
          exhibitNum:  e.exhibitNum  || 1,
          title:       clean(e.title),
          chartIndex:  typeof e.chartIndex === 'number' ? e.chartIndex : 0,
          kpi: e.kpi ? {
            icon:        cleanIcon(e.kpi.icon || '📊'),
            title:       clean(e.kpi.title),
            keyMetric:   clean(e.kpi.keyMetric),
            description: clean(e.kpi.description),
          } : null,
          annotations: (e.annotations || []).slice(0, 3).map(a => ({
            period:      clean(a.period),
            label:       clean(a.label),
            description: clean(a.description),
            icon:        cleanIcon(a.icon || ''),
          })),
          insights: (e.insights || []).map(clean),
          source:   clean(e.source),
        })),
        takeaways: (p.takeaways || []).map(clean),
      };
    }
  } catch (e) {
    console.error('PPT spec parse failed:', e.message, '\nRaw (first 400):', text.slice(0, 400));
  }
  // Minimal fallback so the renderer never crashes
  return {
    layout:        'single',
    slideTitle:    'DATA ANALYSIS',
    slideSubtitle: '',
    exhibits:      [{ exhibitNum: 1, title: 'Chart Analysis', chartIndex: 0, kpi: null, annotations: [], insights: [], source: '' }],
    takeaways:     [],
  };
}

// ── Build the AI prompt for slide design ─────────────────────────────────────
function buildPPTPrompt(blocks) {
  const count = blocks.length;
  const layoutMap = { 1: 'single', 2: 'stacked-2', 3: 'grid-3', 4: 'grid-4' };
  const layout = layoutMap[Math.min(count, 4)] || 'single';

  const chartDesc = blocks.map((b, i) => {
    const lines = [
      `CHART ${i + 1}:`,
      `  Context: ${b.context || ''}`,
      `  Chart type: ${b.chartType || 'auto'}`,
      `  Data:\n${(b.dataRaw || '').slice(0, 500)}`,
    ];
    if (b.kpiTitle)       lines.push(`  Previously generated KPI title: ${b.kpiTitle}`);
    if (b.kpiSubtitle)    lines.push(`  Previously generated KPI metric: ${b.kpiSubtitle}`);
    if (b.kpiDescription) lines.push(`  Previously generated KPI description: ${b.kpiDescription}`);
    if (b.kpiIcon)        lines.push(`  Previously generated KPI icon: ${b.kpiIcon}`);
    if (b.insights?.length) lines.push(`  Previously generated insights:\n${b.insights.map((s, j) => `    ${j + 1}. ${s}`).join('\n')}`);
    if (b.annotations?.length) lines.push(`  Previously generated annotations: ${JSON.stringify(b.annotations)}`);
    if (b.source)         lines.push(`  Source: ${b.source}`);
    if (b.slideSubtitle)  lines.push(`  Previously generated slide subtitle: ${b.slideSubtitle}`);
    return lines.join('\n');
  }).join('\n\n---\n\n');

  const kpiBlock = layout === 'single' || layout === 'stacked-2'
    ? `      "kpi": {
        "icon": "single most relevant emoji",
        "title": "2-5 WORD NOUN PHRASE — NOT a sentence",
        "keyMetric": "One data-backed sentence with exact number + timeframe. Max 18 words.",
        "description": "2-3 consulting sentences with specific data. No em dashes."
      },
      "annotations": [
        { "period": "first time range", "label": "2-3 word phase", "description": "15-20 words, ≥1 specific number", "icon": "emoji" },
        { "period": "second range",     "label": "phase name",    "description": "insight with number",           "icon": "emoji" },
        { "period": "third range",      "label": "phase name",    "description": "insight with number",           "icon": "emoji" }
      ],`
    : `      "insights": [
        "insight 1 for this chart only, 15-20 words",
        "insight 2 for this chart only"
      ],`;

  return `You are a BCG senior presentation designer. Generate a complete professional A4 PowerPoint slide specification.

PAGE SIZE: 8.27 inches × 11.69 inches (A4 portrait)
NUMBER OF CHARTS: ${count}
LAYOUT TO USE: "${layout}"

${chartDesc}

DESIGN REQUIREMENTS:
- BCG/McKinsey professional style: white background, teal (#3AA4A9) accents, dark teal (#1A4A4C) for headers
- Each exhibit has: teal badge section left + dark title bar right + teal bottom accent on title bar
- Layout "${layout}":
  ${layout === 'single'    ? '1 chart full width + KPI panel on the right (190px)' : ''}
  ${layout === 'stacked-2' ? '2 charts stacked vertically, each with KPI panel on the right' : ''}
  ${layout === 'grid-3'    ? '3 charts in a grid: 2 on top row + 1 centred on bottom row; compact, no KPI panels' : ''}
  ${layout === 'grid-4'    ? '4 charts in a 2×2 grid; compact, no KPI panels' : ''}
- For stacked/single: each exhibit has 3 period annotations below chart + source line
- Key Takeaways section at the very bottom with ✓ bullet points
- No em dashes anywhere — use hyphens

Return ONLY valid JSON with NO markdown fences, NO explanation:

{
  "layout": "${layout}",
  "slideTitle": "ALL CAPS, MAX 8 WORDS, ANALYTICAL THEME",
  "slideSubtitle": "1-2 sentences capturing the macro story (20-35 words). No em dashes.",
  "exhibits": [
    {
      "exhibitNum": 1,
      "title": "Descriptive title with timeframe in parentheses",
      "chartIndex": 0,
${kpiBlock}
      "source": "Source name if mentioned, else empty string"
    }${count > 1 ? ` — repeat for each of the ${count} charts` : ''}
  ],
  "takeaways": [
    "Insight 1: lead with a specific % or value. Wrap 1-3 KEY TERMS in [[double brackets]] for bold highlighting. 15-25 words.",
    "Insight 2: different analytical angle. Wrap key terms in [[double brackets]].",
    "Insight 3: third distinct insight with data point.",
    "Insight 4: forward-looking or comparative takeaway."
  ]
}

STRICT RULES:
- ALL numbers must come from the actual data provided — never fabricate
- No em dashes or en dashes (— or –) anywhere; use hyphens (-)
- annotations: EXACTLY 3 entries covering the FULL time range in the data
- takeaways: 3-5 items total for the whole slide
- exhibitNum starts at 1 and increments per chart
- kpi.title: noun phrase ONLY — never a full sentence
- [[keyword]] only in takeaways items — wrap 1-3 key terms per bullet`;
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SlideMaker API running on port ${PORT}`));
