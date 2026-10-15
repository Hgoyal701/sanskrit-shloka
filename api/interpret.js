// api/interpret.js
// Vercel / Next.js-style serverless function. POST { shloka: "..." } -> JSON response.
// Place at: /api/interpret.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { shloka } = req.body || {};
    const text = (shloka || "").toString().trim();
    if (!text) return res.status(400).json({ error: "Please provide a shloka." });

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY missing");
      return res.status(500).json({ error: "Server misconfigured: OPENAI_API_KEY missing" });
    }

    const MODEL = process.env.MODEL || "gpt-3.5-turbo";
    const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "700", 10);
    const TEMPERATURE = parseFloat(process.env.TEMPERATURE || "0.25");

    // Ask the model to return strict JSON. If it doesn't, we'll fall back safely.
    const systemPrompt = `You are an expert Sanskrit scholar and translator.
Return only a JSON object (no markdown, no surrounding commentary) with the exact keys:
translation, notes, inner_meaning, takeaway.
If a key cannot be filled, return it with an empty string.`;

    const userPrompt = `Interpret this Sanskrit shloka and return the JSON.

Shloka:
"""${text}"""`;

    const payload = {
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE
    };

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    // Get structured response if possible
    let openaiJson;
    try {
      openaiJson = await openaiRes.json();
    } catch (e) {
      const txt = await openaiRes.text();
      console.error("Failed to parse OpenAI response as JSON:", txt);
      return res.status(502).json({ error: "OpenAI response parse error", detail: txt });
    }

    if (!openaiRes.ok) {
      console.error("OpenAI API error:", openaiJson);
      return res.status(openaiRes.status || 502).json({ error: "OpenAI API error", detail: openaiJson });
    }

    const content = openaiJson?.choices?.[0]?.message?.content ?? "";
    const trimmed = content.trim();

    // Try to extract a JSON substring and parse it
    let parsedJson = null;
    try {
      const firstBrace = trimmed.indexOf("{");
      const lastBrace = trimmed.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const maybe = trimmed.slice(firstBrace, lastBrace + 1);
        parsedJson = JSON.parse(maybe);
      }
    } catch (err) {
      parsedJson = null;
    }

    // If we have parsed JSON and it has at least one expected key, return it as result
    const hasKeys =
      parsedJson &&
      (Object.prototype.hasOwnProperty.call(parsedJson, "translation") ||
        Object.prototype.hasOwnProperty.call(parsedJson, "notes") ||
        Object.prototype.hasOwnProperty.call(parsedJson, "inner_meaning") ||
        Object.prototype.hasOwnProperty.call(parsedJson, "takeaway"));

    if (hasKeys) {
      // Ensure all expected keys exist
      const result = {
        translation: parsedJson.translation ?? "",
        notes: parsedJson.notes ?? "",
        inner_meaning: parsedJson.inner_meaning ?? "",
        takeaway: parsedJson.takeaway ?? ""
      };
      return res.status(200).json({ result });
    }

    // Fallback: return raw content so client can display it
    return res.status(200).json({ result: { text: trimmed } });
  } catch (error) {
    console.error("Server error in /api/interpret:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
