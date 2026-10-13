// api/interpret.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { shloka } = req.body || {};
    const text = (shloka || "").toString().trim();
    if (!text) return res.status(400).json({ error: "Please provide a shloka in the request body." });

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      console.error("OPENAI_API_KEY not set");
      return res.status(500).json({ error: "OpenAI API key not configured on the server." });
    }

    // Default model; change via environment variable MODEL if you prefer (e.g., 'gpt-4').
    const model = process.env.MODEL || "gpt-3.5-turbo";

    const systemPrompt = `You are an expert Sanskrit scholar and classical commentator. When given a Sanskrit shloka, produce a concise explanation.
Respond with a JSON object that has these keys: translation, notes, inner_meaning, takeaway.
If you cannot provide a field, return an empty string for it.
Do NOT add any extra commentary outside the JSON object.`;

    const userPrompt = `Interpret this Sanskrit shloka and return only a JSON object with keys translation, notes, inner_meaning, takeaway.\n\nShloka:\n${text}`;

    const payload = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.25,
      max_tokens: 700
    };

    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const respText = await openaiResp.text();

    if (!openaiResp.ok) {
      console.error("OpenAI error", openaiResp.status, respText);
      // Return error + raw OpenAI response for debugging
      return res.status(openaiResp.status).json({ error: "OpenAI API request failed", detail: respText });
    }

    // openai returned ok - parse JSON
    // Try to parse the response JSON (the fetch text might include JSON inside text)
    let modelOutput = respText;
    try {
      // parse the full response as JSON and pull message content if possible
      const parsedResp = JSON.parse(respText);
      modelOutput = parsedResp?.choices?.[0]?.message?.content ?? modelOutput;
    } catch (e) {
      // respText might already be the content, continue
    }

    // Attempt to extract the JSON object from the model output
    let parsedResult = null;
    try {
      const start = modelOutput.indexOf("{");
      const end = modelOutput.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        const candidate = modelOutput.slice(start, end + 1);
        parsedResult = JSON.parse(candidate);
      }
    } catch (e) {
      parsedResult = null;
    }

    if (parsedResult && typeof parsedResult === "object") {
      return res.status(200).json({ result: parsedResult, raw: modelOutput });
    }

    // fallback: return raw model text so front-end can display
    return res.status(200).json({ text: modelOutput });
  } catch (err) {
    console.error("Handler exception:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
