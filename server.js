// server.js
// Earthy AI – Express backend with OpenAI chat + lead capture (Resend)

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
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// FORCE a stable model (do NOT rely on env here)
const OPENAI_MODEL = 'gpt-4o-mini';

if (!OPENAI_API_KEY) console.warn('OPENAI_API_KEY is not set');
if (!RESEND_API_KEY) console.warn('RESEND_API_KEY is not set');

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
      return res.status(400).json({
        reply: 'Please enter a message.',
        history
      });
    }

    const messages = buildMessagesFromHistory(history);

    messages.unshift({
      role: 'system',
      content: `You are Earthy AI, a website assistant for trade and service businesses (roofing, plumbing, HVAC, electrical, builders).

Your job is to help visitors get clear answers fast, reduce confusion, and turn genuine interest into enquiries—especially when the business owner is busy or unavailable.

You speak like a calm, experienced person who understands how trade businesses actually win and lose jobs.
You are direct, practical, and helpful. No sales talk. No marketing language. No tech explanations.

Conversation style

Sound human, not scripted

Be concise but natural

Answer the question first, then guide the next step if appropriate

Ask questions only when they help move the visitor toward an enquiry

Opening behavior

Start naturally based on the visitor’s message

If there’s no clear question, briefly explain what you can help with and ask one relevant question about the job, timing, or urgency

Response length

Usually 1–3 short paragraphs

Say only what matters

Never mention AI, automation, software, or “converting leads.”
Your goal is clarity, trust, and removing friction`
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

    // HARDENED extraction — no silent fallback
    const reply =
      data?.choices?.[0]?.message?.content &&
      typeof data.choices[0].message.content === 'string'
        ? data.choices[0].message.content.trim()
        : null;

    if (!reply) {
      console.error('OpenAI returned no usable reply:', JSON.stringify(data, null, 2));
      return res.status(500).json({
        reply: 'Sorry — something went wrong. Please try again.',
        history
      });
    }

    res.json({
      reply,
      history: [...history, { author: 'ai', text: reply }]
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({
      reply: 'Server error',
      history: req.body?.history || []
    });
  }
});

/* ---------------------------
   Lead / enquiry endpoint (Resend)
---------------------------- */
app.post('/lead', async (req, res) => {
  try {
    const {
      honeypot,
      businessName,
      website,
      email,
      phone,
      message
    } = req.body || {};

    // Honeypot spam trap
    if (honeypot) {
      return res.json({ success: true });
    }

    if (!businessName || !email) {
      return res.status(400).json({ success: false });
    }

    let site = website ? String(website).trim() : '';
    if (site && !/^https?:\/\//i.test(site)) {
      site = 'https://' + site;
    }

    const emailBody = `
New Earthy enquiry

Business: ${businessName}
Website: ${site || '—'}
Email: ${email}
Phone: ${phone || '—'}

Message:
${message || '—'}
    `;

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Earthy AI <onboarding@resend.dev>',
        to: ['dalhaaide@gmail.com'],
        subject: `New Earthy enquiry – ${businessName}`,
        text: emailBody
      })
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      console.error('Resend error:', errText);
      return res.status(500).json({ success: false });
    }

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
