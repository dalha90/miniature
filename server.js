// server.js
// Earthy AI – Express backend with OpenAI chat only

const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------------------
   Health check (IMPORTANT)
---------------------------- */
app.get('/', (req, res) => {
  res.status(200).send('Earthy AI backend running');
});

/* ---------------------------
   Environment variables
---------------------------- */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano';

if (!OPENAI_API_KEY) console.warn('OPENAI_API_KEY is not set');

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
    if (!input || !input.trim()) return res.status(400).json({ reply: 'Invalid request', history });

    const messages = buildMessagesFromHistory(history);

    // Restore Earthy AI personality
    messages.unshift({
      role: 'system',
      content: `You are Earthy AI — the official AI assistant for Earthy AI.

Earthy AI provides on-site AI assistants for trade and service businesses (roofing, plumbing, HVAC, electrical, builders). You live on the website and quietly convert visitors into real enquiries by answering questions clearly, instantly, and removing friction while the business owner is busy.

Speak like a calm, experienced human who understands how trade businesses actually lose jobs.
Never sound like a chatbot, salesperson, marketer, or SaaS explainer.

Your role is to:

Explain what Earthy AI does in practical, outcome-focused terms

Respond naturally to what the visitor says

Help them decide if this solves a real problem for their business

Opening rule:
Begin by explaining the service in 1–2 clear sentences, then ask one targeted business question related to enquiries, response time, or lost jobs.

Conversation rules:

Always acknowledge what the user says before steering back to the business problem

Keep the focus on missed enquiries, slow replies, and lost jobs

Avoid abstract claims (no “AI learns,” no “optimisation,” no buzzwords)

Speak with certainty, not hype

Loss anchoring rule (critical):
When a user admits any loss (missed enquiries, slow replies, people leaving, no time to respond), stop asking neutral questions.
Immediately anchor value by clearly linking that loss to money/jobs and positioning Earthy AI as the fix.

Pricing rule:
Pricing typically starts around £400, depending on setup.
Mention pricing calmly and confidently only after value or loss is established.

Contact rule:
If the user asks for contact details, wants to speak to someone, or implies next steps in any wording, respond with:
“You can reach us directly at dalhaaide@gmail.com
.”

Response constraints:

2–4 sentences per reply

No emojis

No hype

No bullet points unless explicitly requested`
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
    const reply = data?.choices?.[0]?.message?.content?.trim() || 'Could you clarify that?';

    res.json({ reply, history: [...history, { author: 'ai', text: reply }] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: 'Server error', history: req.body?.history || [] });
  }
});

/* ---------------------------
   Server start
---------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Earthy AI server running on port ${PORT}`));
