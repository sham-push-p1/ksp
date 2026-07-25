const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const USE_QUICKML = process.env.USE_QUICKML === "true";

async function callOllama(model, systemPrompt, userPrompt, options = {}) {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
      stream: false,
      options: { temperature: options.temperature ?? 0.1, num_predict: options.maxTokens ?? 1024 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.message?.content?.trim() || "";
}

async function llmCall(role, systemPrompt, userPrompt, options = {}) {
  if (USE_QUICKML) {
    const res = await fetch(process.env.QUICKML_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.QUICKML_TOKEN}` },
      body: JSON.stringify({
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens ?? 1024,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  }
  const modelMap = { fast: "qwen2.5:3b", smart: "qwen2.5:3b" };
  return callOllama(modelMap[role] || role, systemPrompt, userPrompt, options);
}

async function getEmbedding(text) {
  const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
  });
  const data = await res.json();
  return data.embedding || [];
}

module.exports = { llmCall, getEmbedding };
