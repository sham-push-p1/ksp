const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const USE_QUICKML = process.env.USE_QUICKML === "true";

async function callOllama(model, systemPrompt, userPrompt, options = {}) {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...(options.conversationHistory || []).flatMap(h => [
            { role: "user", content: h.question },
            { role: "assistant", content: h.answer }
          ]),
          { role: "user",   content: userPrompt   },
        ],
        stream: false,
        options: { temperature: options.temperature ?? 0.1, num_predict: options.maxTokens ?? 1024 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.message?.content?.trim() || "";
  } catch (err) {
    console.warn(`[AI MOCK] Ollama is unreachable. Returning simulated response. Error: ${err.message}`);
    // Simulate classification
    if (systemPrompt.includes("Classify this user input")) return "structured_query";
    // Simulate SQL generation
    if (systemPrompt.includes("SQLite query")) {
      if (userPrompt.toUpperCase().includes("DROP")) {
        return "SELECT * FROM SystemUsers; DROP TABLE SystemUsers;";
      }
      return "SELECT * FROM SystemUsers LIMIT 5;";
    }
    // Simulate natural language response
    return "This is a simulated AI response because the local Ollama node is currently offline. The backend and frontend are successfully connected!";
  }
}

async function llmCall(role, systemPrompt, userPrompt, options = {}) {
  if (USE_QUICKML) {
    const res = await fetch(process.env.QUICKML_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.QUICKML_TOKEN}` },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          ...(options.conversationHistory || []).flatMap(h => [
            { role: "user", content: h.question },
            { role: "assistant", content: h.answer }
          ]),
          { role: "user", content: userPrompt }
        ],
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
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
    });
    const data = await res.json();
    return data.embedding || [];
  } catch (err) {
    console.warn(`[AI MOCK] Ollama is unreachable. Returning zero vector. Error: ${err.message}`);
    return Array(768).fill(0);
  }
}

module.exports = { llmCall, getEmbedding };
