require('dotenv').config();
const { llmCall, getEmbedding } = require('./functions/nl-to-zcql/ollama');

async function main() {
  try {
    const embed = await getEmbedding("hello world");
    console.log("Embed result length:", embed.length);
    
    const ans = await llmCall("fast", "You are a helpful assistant.", "Say hello!");
    console.log("LLM Answer:", ans);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
