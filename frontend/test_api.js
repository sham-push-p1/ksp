async function test() {
  const apiKey = "AQ.Ab8RN6K-pbpx7Bx1I731EUiEC7EGqnD4snZYCtRIo_qv_4LEMQ";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
  const prompt = "User: Show crime trends by district for the last 2 years";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: "You are a helpful assistant." }] }
      })
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Body:", text.substring(0, 300));
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
