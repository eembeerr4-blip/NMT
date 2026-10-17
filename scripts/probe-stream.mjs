const controller = new AbortController();
const response = await fetch("http://127.0.0.1:11434/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "qwen3:4b",
    stream: true,
    think: false,
    messages: [
      { role: "system", content: "Відповідай українською одним коротким реченням." },
      { role: "user", content: "Скільки буде 2+2?" },
    ],
  }),
  signal: controller.signal,
});
const reader = response.body.getReader();
const decoder = new TextDecoder();
let text = "";
let chunks = 0;
const timer = setTimeout(() => controller.abort(), 8000);
try {
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    chunks += 1;
    text += decoder.decode(chunk.value, { stream: true });
    if (chunks >= 2) {
      controller.abort();
      break;
    }
  }
} catch (error) {
  if (error.name !== "AbortError") throw error;
}
clearTimeout(timer);
console.log(JSON.stringify({ chunks, aborted: true, sample: text.slice(0, 180) }));
