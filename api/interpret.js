export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { shloka } = req.body || {};
    if (!shloka || typeof shloka !== "string" || !shloka.trim()) {
      return res.status(400).json({ error: "Please provide a shloka." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OpenAI API key is missing." });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a Sanskrit scholar and spiritual teacher. Explain Sanskrit shlokas clearly in English. Return only valid JSON with keys: translation, notes, inner_meaning, takeaway. Keep it helpful, respectful, and accurate."
          },
          {
            role: "user",
            content: `Interpret this Sanskrit shloka and return JSON with keys translation, notes, inner_meaning, takeaway.\n\nShloka:\n${shloka}`
          }
        ],
        temperature: 0.3,
        max_tokens: 700
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: "OpenAI request failed.", detail: errorText });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1));
      }
    } catch (err) {
      parsed = null;
    }

    if (parsed) {
      return res.status(200).json({ result: parsed });
    }

    return res.status(200).json({ text });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error while processing shloka." });
  }
}
