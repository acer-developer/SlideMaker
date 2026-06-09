const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'slidemaker-api' }));

app.post('/api/generate', async (req, res) => {
  const { dataRaw, context, instructions, apiKey, provider } = req.body;
  if (!dataRaw || !context) return res.status(400).json({ error: 'dataRaw and context are required' });

  const prompt = buildPrompt(dataRaw, context, instructions);

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

function buildPrompt(dataRaw, context, instructions) {
  return `You are a senior research analyst at a tier-1 strategy consulting firm (BCG/McKinsey level). Analyze the data below and produce a structured JSON response for a professional research slide.

Data:
${dataRaw}

Context: ${context}
${instructions?.trim() ? `\nInstructions (follow strictly): ${instructions}\n` : ''}
Return ONLY valid JSON with no markdown fences, no explanation, no preamble — just the raw JSON object:

{
  "kpiTitle": "2-4 word headline noun phrase capturing the key story (e.g. 'Rupee Depreciation', 'Revenue Acceleration', 'Cost Pressure Intensifies'). NOT a full sentence.",
  "kpiSubtitle": "One precise data-backed sentence — key metric + magnitude + timeframe (e.g. 'USD/INR rose 30% from 73.8 to 95.7 between FY21 and FY26'). Max 20 words.",
  "kpiDescription": "2-3 sentences elaborating the business implication. Reference specific data points. Consulting-grade, no jargon. No em dashes.",
  "annotations": [
    {"period": "<first time segment or category group from the data>", "label": "<2-4 word phase name>", "description": "<one sentence, 12-18 words, with a specific number>"},
    {"period": "<second segment>", "label": "<phase name>", "description": "<insight with number>"},
    {"period": "<third segment>", "label": "<phase name>", "description": "<insight with number>"}
  ],
  "insights": [
    "<Insight 1: lead with a specific % or absolute value, include trend direction and implication, 15-25 words>",
    "<Insight 2>",
    "<Insight 3>",
    "<Insight 4>",
    "<Insight 5: forward-looking or comparative takeaway>"
  ]
}

Rules:
- ALL numbers must come from the actual data provided — never fabricate
- No em dashes (—) or en dashes (–) anywhere — use hyphens (-)
- No markdown formatting inside any string value
- annotations: split data into exactly 3 logical time periods or category buckets; use actual labels/ranges from the data as period values
- kpiTitle: noun phrase only, max 5 words, NOT a sentence
- insights: exactly 4-5 items, each must open with a data point`;
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
      max_tokens: 800,
      temperature: 0.3,
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
      max_tokens: 800,
      temperature: 0.3,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'NVIDIA NIM error');
  return parseResponse(data.choices[0].message.content);
}

function parseResponse(text) {
  const clean = s => (s || '').replace(/[—–]/g, '-').trim();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        insights: (parsed.insights || []).map(clean).filter(s => s.length > 8).slice(0, 5),
        kpiTitle: clean(parsed.kpiTitle),
        kpiSubtitle: clean(parsed.kpiSubtitle),
        kpiDescription: clean(parsed.kpiDescription),
        annotations: (parsed.annotations || []).slice(0, 3).map(a => ({
          period: clean(a.period),
          label: clean(a.label),
          description: clean(a.description),
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
    annotations: [],
  };
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SlideMaker API running on port ${PORT}`));
