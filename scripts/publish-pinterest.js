import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const queuePath = path.join(ROOT, "data", "pinterest-queue.json");
const logPath = path.join(ROOT, "data", "publication-log.json");
const token = process.env.PINTEREST_ACCESS_TOKEN;
const defaultBoardId = process.env.PINTEREST_BOARD_ID;
const now = () => new Date().toISOString();

const queue = JSON.parse(await fs.readFile(queuePath, "utf8"));
let log;
try { log = JSON.parse(await fs.readFile(logPath, "utf8")); }
catch { log = { generatedAt: now(), summary: { published: 0, failed: 0, skipped: 0 }, events: [] }; }
if (!Array.isArray(log.events)) log.events = [];

function addEvent(event) {
  log.events.unshift({ timestamp: now(), channel: "Pinterest", ...event });
  log.events = log.events.slice(0, 500);
}

const candidates = queue.items.filter(item => item.status === "aprovado");
if (!token) {
  const message = "Credencial PINTEREST_ACCESS_TOKEN ausente; nenhuma publicação realizada.";
  console.log(message);
  addEvent({ siteId: null, siteName: null, status: "ignorado", destination: "Pinterest", message });
} else if (!candidates.length) {
  const message = "Nenhum Pin com aprovação explícita; nenhuma publicação realizada.";
  console.log(message);
  addEvent({ siteId: null, siteName: null, status: "ignorado", destination: "Pinterest", message });
} else {
  function validHttps(value) {
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }
  const sites = JSON.parse(await fs.readFile(path.join(ROOT, "config", "sites.json"), "utf8"));
  for (const item of candidates) {
    const site = sites.find(s => s.id === item.siteId);
    const boardId = item.boardId || defaultBoardId;
    if (!validHttps(item.link) || !validHttps(item.imageUrl)) {
      item.status = "erro_validacao";
      item.lastError = "O link do site e a imagem pública precisam usar HTTPS.";
      addEvent({ siteId: item.siteId, siteName: site?.name || item.siteId, title: item.title, targetUrl: item.link, destination: "Pinterest", status: "falhou", message: item.lastError });
      continue;
    }
    if (!boardId) {
      item.status = "erro_configuracao";
      item.lastError = "Defina boardId no item ou configure PINTEREST_BOARD_ID.";
      addEvent({ siteId: item.siteId, siteName: site?.name || item.siteId, title: item.title, targetUrl: item.link, destination: "Pinterest", status: "falhou", message: item.lastError });
      continue;
    }
    try {
      const response = await fetch("https://api.pinterest.com/v5/pins", {
        method: "POST",
        headers: {
          authorization: "Bearer " + token,
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({
          board_id: boardId,
          title: item.title.slice(0, 100),
          description: item.description.slice(0, 800),
          link: item.link,
          media_source: { source_type: "image_url", url: item.imageUrl }
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || result.code || "HTTP " + response.status);
      item.status = "publicado";
      item.pinId = result.id || null;
      item.publishedAt = now();
      item.publishedUrl = result.id ? "https://www.pinterest.com/pin/" + encodeURIComponent(result.id) + "/" : null;
      item.publishedDestination = "Pinterest";
      delete item.lastError;
      addEvent({
        siteId: item.siteId, siteName: site?.name || item.siteId, title: item.title,
        targetUrl: item.link, destination: "Pinterest", boardId,
        postId: result.id || null, postUrl: item.publishedUrl,
        status: "publicado", message: "Pinterest confirmou a criação do Pin."
      });
      console.log("Pin publicado:", item.id, item.pinId || "");
    } catch (e) {
      item.status = "erro_publicacao";
      item.lastError = String(e.message || e);
      addEvent({ siteId: item.siteId, siteName: site?.name || item.siteId, title: item.title, targetUrl: item.link, destination: "Pinterest", boardId, status: "falhou", message: item.lastError });
      console.error("Falha ao publicar", item.id, item.lastError);
    }
  }
}

queue.updatedAt = now();
log.generatedAt = now();
log.summary = {
  published: log.events.filter(e => e.status === "publicado").length,
  failed: log.events.filter(e => e.status === "falhou").length,
  skipped: log.events.filter(e => e.status === "ignorado").length
};
await fs.writeFile(queuePath, JSON.stringify(queue, null, 2) + "\n");
await fs.writeFile(logPath, JSON.stringify(log, null, 2) + "\n");
