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

  // BYOK: user-supplied key takes priority over server env vars
  if (apiKey && provider === 'openrouter') {
    try {
      const insights = await callOpenRouter(apiKey, prompt);
      return res.json({ insights });
    } catch (e) {
      console.error('BYOK OpenRouter failed:', e.message);
      return res.status(400).json({ error: 'OpenRouter key error: ' + e.message });
    }
  }
  if (apiKey && provider === 'nvidia') {
    try {
      const insights = await callNvidia(apiKey, prompt);
      return res.json({ insights });
    } catch (e) {
      console.error('BYOK NVIDIA failed:', e.message);
      return res.status(400).json({ error: 'NVIDIA NIM key error: ' + e.message });
    }
  }

  // Fallback: server env var keys
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;

  if (openrouterKey) {
    try {
      const insights = await callOpenRouter(openrouterKey, prompt);
      return res.json({ insights });
    } catch (e) {
      console.error('Server OpenRouter failed, trying NVIDIA:', e.message);
    }
  }
  if (nvidiaKey) {
    try {
      const insights = await callNvidia(nvidiaKey, prompt);
      return res.json({ insights });
    } catch (e) {
      console.error('Server NVIDIA failed:', e.message);
    }
  }
  res.status(503).json({ error: 'AI generation unavailable. Add your API key in Preferences.' });
});

function buildPrompt(dataRaw, context, instructions) {
  const base = `You are a senior research analyst writing insights for a professional research slide deck.

Data:
${dataRaw}

Context: ${context}
${instructions?.trim() ? `\nInstructions (follow strictly): ${instructions}\n` : ''}
Write 4 to 5 sharp, specific, data-backed bullet insights suitable for a research report.

Rules:
- Each insight on its own line starting with a dash (-)
- Lead with the key number or percentage — be precise (e.g. "Revenue grew 34% YoY from $120K to $161K")
- Include trend direction, magnitude, and business implication in each point
- Note any standout peaks, drops, or inflection points with exact values
- Last insight should be a forward-looking or comparative takeaway
- Do NOT use em dashes, en dashes, or markdown formatting
- Do NOT add preamble, headers, or explanation — bullets only`;

  return base;
}

async function callOpenRouter(key, prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://slidemaker.app' },
    body: JSON.stringify({ model: 'meta-llama/llama-3.3-70b-instruct:free', messages: [{ role: 'user', content: prompt }], max_tokens: 400, temperature: 0.3 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'OpenRouter error');
  return parseInsights(data.choices[0].message.content);
}

async function callNvidia(key, prompt) {
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'meta/llama-3.1-70b-instruct', messages: [{ role: 'user', content: prompt }], max_tokens: 400, temperature: 0.3 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'NVIDIA NIM error');
  return parseInsights(data.choices[0].message.content);
}

function parseInsights(text) {
  return text.split('\n').map(l => l.replace(/^[-*]\s*/, '').replace(/[—–]/g, '-').trim()).filter(l => l.length > 8).slice(0, 5);
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SlideMaker API running on port ${PORT}`));
