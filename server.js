import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": "text/plain; charset=utf-8", allow: "GET, HEAD" });
    return res.end("Method Not Allowed");
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
  } catch {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Bad Request");
  }

  if (pathname === "/health" || pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    return res.end(JSON.stringify({ ok: true, service: "divulga-odesistes", time: new Date().toISOString() }));
  }

  if (pathname === "/") pathname = "/index.html";
  const requested = path.resolve(ROOT, "." + pathname);
  if (requested !== ROOT && !requested.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Forbidden");
  }

  try {
    const stat = await fs.stat(requested);
    if (!stat.isFile()) throw new Error("Not a file");
    const body = await fs.readFile(requested);
    const ext = path.extname(requested).toLowerCase();
    const headers = {
      "content-type": TYPES[ext] || "application/octet-stream",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "cache-control": ext === ".html" || ext === ".json" ? "no-store" : "public, max-age=300"
    };
    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();
    return res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("Not Found");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Central de Divulgação 24h escutando em http://${HOST}:${PORT}`);
});

function shutdown(signal) {
  console.log(`Recebido ${signal}; encerrando servidor HTTP.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
