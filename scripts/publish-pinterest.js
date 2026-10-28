import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const queuePath = path.join(ROOT, "data", "pinterest-queue.json");
const token = process.env.PINTEREST_ACCESS_TOKEN;
const defaultBoardId = process.env.PINTEREST_BOARD_ID;

if (!token) {
  console.log("Pinterest não configurado: secret PINTEREST_ACCESS_TOKEN ausente. Nenhuma publicação feita.");
  process.exit(0);
}
const queue = JSON.parse(await fs.readFile(queuePath, "utf8"));
const candidates = queue.items.filter(item => item.status === "aprovado");
if (!candidates.length) {
  console.log("Nenhum Pin aprovado. Nenhuma publicação feita.");
  process.exit(0);
}

function validHttps(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
for (const item of candidates) {
  if (!validHttps(item.link) || !validHttps(item.imageUrl)) {
    item.status = "erro_validacao";
    item.lastError = "O link do site e a imagem pública precisam usar HTTPS.";
    continue;
  }
  const boardId = item.boardId || defaultBoardId;
  if (!boardId) {
    item.status = "erro_configuracao";
    item.lastError = "Defina boardId no item ou configure PINTEREST_BOARD_ID.";
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
    item.publishedAt = new Date().toISOString();
    delete item.lastError;
    console.log("Pin publicado:", item.id, item.pinId || "");
  } catch (e) {
    item.status = "erro_publicacao";
    item.lastError = String(e.message || e);
    console.error("Falha ao publicar", item.id, item.lastError);
  }
}
queue.updatedAt = new Date().toISOString();
await fs.writeFile(queuePath, JSON.stringify(queue, null, 2) + "\n");
