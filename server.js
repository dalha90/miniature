// server.js
// Earthy AI – Express backend with OpenAI chat + lead capture

const express = require('express');
const cors = require('cors');
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------------------
   Health check
---------------------------- */
app.get('/', (req, res) => {
  res.status(200).send('Earthy AI backend running');
});

/* ---------------------------
   Environment variables
---------------------------- */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano';

if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY is not set');
}

/* ---------------------------
   Helper: build messages
---------------------------- */
function buildMessagesFromHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(m => m && m.text && m.author)
    .map(m => ({
      role: m.author === 'user' ? 'user' : 'assistant',
      content: m.text
    }));
}

/* ---------------------------
   Chat endpoint
---------------------------- */
app.post('/chat', async (req, res) => {
  try {
    const { input, history = [] } = req.body || {};
    if (!input || !input.trim()) {
      return res.status(400).json({ reply: 'Invalid request', history });
    }

    const messages = buildMessagesFromHistory(history);

    messages.unshift({
      role: 'system',
      content: `You are Earthy AI — the official AI assistant for Earthy AI.

Earthy AI provides on-site AI assistants for trade and service businesses (roofing, plumbing, HVAC, electrical, builders). You live on the website and quietly convert visitors into real enquiries by answering questions clearly, instantly, and removing friction while the business owner is busy.

Speak like a calm, experienced human who understands how trade businesses actually lose jobs.
Never sound like a chatbot, salesperson, marketer, or SaaS explainer.

Opening rule:
Begin by explaining the service in 1–2 clear sentences, then ask one targeted business question related to enquiries, response time, or lost jobs.

Keep replies 2–4 sentences. No hype. No emojis.`
    });

    messages.push({ role: 'user', content: input });

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        max_tokens: 150,
        temperature: 0.6
      })
    });

    const data = await openaiResp.json();
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      'Could you clarify that?';

    res.json({
      reply,
      history: [...history, { author: 'ai', text: reply }]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      reply: 'Server error',
      history: req.body?.history || []
    });
  }
});

/* ---------------------------
   Lead / enquiry endpoint
---------------------------- */
app.post('/lead', (req, res) => {
  try {
    const {
      businessName,
      website,
      email,
      phone,
      message
    } = req.body || {};

    if (!businessName || !email) {
      return res.status(400).json({ success: false });
    }

    console.log('--- New Earthy Enquiry ---');
    console.log('Business:', businessName);
    console.log('Website:', website);
    console.log('Email:', email);
    console.log('Phone:', phone);
    console.log('Message:', message);
    console.log('-------------------------');

    res.json({ success: true });
  } catch (err) {
    console.error('Lead error:', err);
    res.status(500).json({ success: false });
  }
});

/* ---------------------------
   Server start
---------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Earthy AI server running on port ${PORT}`);
});
