const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'slidemaker-api' }));

app.post('/api/generate', async (req, res) => {
  const { dataRaw, context, instructions, chartType, apiKey, provider } = req.body;
  if (!dataRaw || !context) return res.status(400).json({ error: 'dataRaw and context are required' });

  const prompt = buildPrompt(dataRaw, context, instructions, chartType);

  if (apiKey && provider === 'openrouter') {
    try {
      const result = await callOpenRouter(apiKey, prompt);
      return res.json(result);
    } catch (e) {
      console.error('BYOK OpenRouter failed:', e.message);
      return res.status(400).json({ error: 'OpenRouter key error: ' + e.message });
    }
  }
  if (apiKey && provider === 'nvidia') {
    try {
      const result = await callNvidia(apiKey, prompt);
      return res.json(result);
    } catch (e) {
      console.error('BYOK NVIDIA failed:', e.message);
      return res.status(400).json({ error: 'NVIDIA NIM key error: ' + e.message });
    }
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;

  if (openrouterKey) {
    try {
      const result = await callOpenRouter(openrouterKey, prompt);
      return res.json(result);
    } catch (e) {
      console.error('Server OpenRouter failed, trying NVIDIA:', e.message);
    }
  }
  if (nvidiaKey) {
    try {
      const result = await callNvidia(nvidiaKey, prompt);
      return res.json(result);
    } catch (e) {
      console.error('Server NVIDIA failed:', e.message);
    }
  }
  res.status(503).json({ error: 'AI generation unavailable. Add your API key in Preferences.' });
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SlideMaker API running on port ${PORT}`));
