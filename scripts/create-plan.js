import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sites = JSON.parse(await fs.readFile(path.join(ROOT, "config/sites.json"), "utf8"));
const reportPath = path.join(ROOT, "data", "promotion-plan.json");
const day = new Date().toISOString().slice(0, 10);
const channels = ["Pinterest (rascunho para revisão)", "redes sociais oficiais (rascunho para revisão)", "SEO e links internos (recomendação)"];
const plan = {
  generatedAt: new Date().toISOString(),
  notice: "São sugestões de pauta, não publicações feitas. Revise fatos, direitos autorais, links e regras de cada plataforma antes de publicar.",
  items: sites.map(site => {
    const topic = site.topics[(new Date().getUTCDate() + site.id.length) % site.topics.length];
    return {
      date: day, siteId: site.id, siteName: site.name, url: site.url,
      topic,
      suggestedTitle: `${topic.charAt(0).toUpperCase() + topic.slice(1)}: guia prático`,
      actions: [
        `Criar ou melhorar uma página original e útil sobre “${topic}”, sem duplicar conteúdo de outro domínio.`,
        "Adicionar links internos relevantes e verificar título, descrição e versão móvel.",
        "Preparar uma publicação adaptada ao canal, com link identificável por UTM e sem promessas enganosas."
      ],
      suggestedChannels: channels,
      status: "aguardando_revisao"
    };
  })
};
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(plan, null, 2) + "\n");
console.log(`Plano diário criado: ${plan.items.length} rascunhos em ${reportPath}`);
