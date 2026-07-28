require('dotenv').config();
const { GoogleGenAI } = require("@google/genai");

async function main() {
  const geminiAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const models = await geminiAi.models.list(); // Or however it is in the new sdk?
    for await (const m of models) {
        console.log(m.name);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
