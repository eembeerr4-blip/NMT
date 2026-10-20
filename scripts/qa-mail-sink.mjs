// Local browser QA helper. Never bind this token-bearing mailbox to a public interface.
import http from "node:http";

const messages = [];
http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/emails") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try {
      const message = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      messages.push(message);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: `qa-${messages.length}` }));
    } catch {
      res.writeHead(400); res.end();
    }
    return;
  }
  if (req.method === "GET" && req.url === "/messages") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(messages));
    return;
  }
  res.writeHead(404); res.end();
}).listen(3102, "127.0.0.1", () => console.log("QA mail sink listening on 127.0.0.1:3102"));
