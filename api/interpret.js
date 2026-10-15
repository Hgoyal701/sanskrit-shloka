// Minimal Vercel Node serverless function.
// Place at: api/interpret.js
// Exposes POST /api/interpret and forwards the shloka to OpenAI's Chat Completions API.
// Uses process.env.OPENAI_API_KEY and process.env.MODEL (optional).

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { shloka } = req.body || {};
    if (!shloka || typeof shloka !== 'string') {
      return res.status(400).json({ error: 'Missing shloka in request body' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const MODEL = process.env.MODEL || 'gpt-3.5-turbo';

    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return res.status(500).json({ error: 'Server misconfigured: OPENAI_API_KEY missing' });
    }

    const systemPrompt = `You are an expert Sanskrit scholar and translator. When given a single Sanskrit shloka, respond with a compact JSON object with keys:
- translation (literal translation),
- notes (context / grammar notes),
- inner_meaning (philosophical/deeper meaning),
- takeaway (short practical takeaway).
Only output valid JSON. If you cannot produce all fields, include what you can.`;

    const userPrompt = `Shloka:\n"""${shloka}"""`;

    const payload = {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800,
      temperature: 0.2
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();

    if (!r.ok) {
      console.error('OpenAI error', r.status, data);
      return res.status(502).json({ error: 'OpenAI API error', details: data });
    }

    const text = data.choices?.[0]?.message?.content ?? '';

    // Try to parse JSON returned by the model. If parsing fails, return raw text under `text`.
    let result;
    try {
      result = JSON.parse(text);
    } catch (err) {
      result = { text };
    }

    return res.status(200).json({ result });
  } catch (err) {
    console.error('Server error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
