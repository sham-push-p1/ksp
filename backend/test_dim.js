require('dotenv').config();
const { GoogleGenAI } = require("@google/genai");

async function main() {
  const geminiAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const emb = await geminiAi.models.embedContent({
      model: 'gemini-embedding-2',
      contents: "hello world",
      config: { outputDimensionality: 768 }
    });
    console.log("Embed result length:", emb.embeddings[0].values.length);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
