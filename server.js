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
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

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

    // If honeypot is filled, silently treat as success to deter bots
    if (honeypot) {
      return res.json({ success: true });
    }

    // Basic validation for required fields
    if (!businessName || !businessName.toString().trim()) {
      return res.status(400).json({ success: false });
    }
    if (!email || !email.toString().trim()) {
      return res.status(400).json({ success: false });
    }

    // Basic email format validation
    const emailStr = String(email).trim();
    const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!simpleEmailRegex.test(emailStr)) {
      return res.status(400).json({ success: false });
    }

    const biz = String(businessName).trim();
    let site = website && String(website).trim() ? String(website).trim() : '';
    const phoneStr = phone && String(phone).trim() ? String(phone).trim() : '';
    const messageStr = message && String(message).trim() ? String(message).trim() : '';

    // Normalize website: add protocol if missing
    if (site && !/^https?:\/\//i.test(site)) {
      site = 'https://' + site;
    }

    const emailBody = `
New Earthy enquiry

Business: ${biz}
Website: ${site || '—'}
Email: ${emailStr}
Phone: ${phoneStr || '—'}

Message:
${messageStr || '—'}
    `;

    // Ensure RESEND_API_KEY exists
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured; cannot send lead email.');
      return res.status(500).json({ success: false });
    }

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Earthy AI <onboarding@resend.dev>',
        to: ['dalhaaide@gmail.com'],
        subject: `New Earthy enquiry – ${biz}`,
        text: emailBody
      })
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text().catch(() => 'No response body');
      console.error('Resend error:', resendResp.status, resendResp.statusText, errText);
      return res.status(500).json({ success: false });
    }

    // All good
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
