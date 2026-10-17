const prompts = [
  "Поясни українською одним реченням, що таке лінійне рівняння. Потім розв'яжи 2x+3=11 і напиши корінь.",
  "Як правильно: «не знаю» чи «незнаю»? Відповідь одним реченням українською.",
  "У якому році відбулося хрещення Русі? Назви рік і князя українською, одним реченням.",
  "Яка органела синтезує АТФ? Відповідь одним реченням українською.",
];

const model = process.argv[2] || "qwen3:4b";

for (const prompt of prompts) {
  const started = Date.now();
  const response = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      messages: [
        { role: "system", content: "Відповідай лише українською, коротко і без роздумів англійською. Не вигадуй джерел." },
        { role: "user", content: prompt },
      ],
    }),
  });
  const data = await response.json();
  const raw = data.message?.content ?? "";
  const text = raw.includes("</think>") ? raw.split("</think>").pop().trim() : raw.trim();
  console.log("\n---", prompt);
  console.log(text.slice(0, 500));
  console.log("ms", Date.now() - started, "eval", data.eval_count);
}
