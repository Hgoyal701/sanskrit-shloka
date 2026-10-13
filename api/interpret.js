export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { shloka } = req.body || {};
    const text = (shloka || "").toString().trim();

    if (!text) {
      return res.status(400).json({ error: "Please provide a shloka." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OpenAI API key is missing on the server." });
    }

    const systemPrompt = `You are an expert Sanskrit scholar and spiritual teacher. Interpret Sanskrit shlokas clearly and accurately.
Respond ONLY with valid JSON with these keys:
translation, notes, inner_meaning, takeaway.
Do not include markdown or extra text.`;

    const userPrompt = `Interpret this Sanskrit shloka.
Return JSON with keys: translation, notes, inner_meaning, takeaway.

Shloka:
${text}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 700
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: "OpenAI request failed", detail: errText });
    }

    const data = await response.json();
    const output = data?.choices?.[0]?.message?.content || "";

    let parsed = null;
    try {
      const first = output.indexOf("{");
      const last = output.lastIndexOf("}");
      if (first !== -1 && last !== -1) {
        parsed = JSON.parse(output.slice(first, last + 1));
      }
    } catch (e) {
      parsed = null;
    }

    if (parsed && typeof parsed === "object") {
      return res.status(200).json({ result: parsed });
    }

    return res.status(200).json({ text: output });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error while interpreting shloka." });
  }
}
