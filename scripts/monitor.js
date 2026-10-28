import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sites = JSON.parse(await fs.readFile(path.join(ROOT, "config/sites.json"), "utf8"));
const outDir = path.join(ROOT, "data");
await fs.mkdir(outDir, { recursive: true });

async function check(url) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "DivulgaOdesistesMonitor/1.0 (+site-health-check)" }
    });
    const body = await res.text();
    return {
      url, status: res.status, ok: res.ok, finalUrl: res.url,
      durationMs: Date.now() - started,
      contentType: res.headers.get("content-type"),
      bytes: Buffer.byteLength(body),
      checkedAt: new Date().toISOString(),
      note: res.ok ? "Resposta HTTP recebida" : `Resposta HTTP ${res.status}`,
      xmlMarkerFound: /<urlset|<sitemapindex/i.test(body),
      preview: body.slice(0, 180).replace(/\s+/g, " ")
    };
  } catch (err) {
    return {
      url, status: null, ok: false, durationMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      note: err.name === "AbortError" ? "Tempo limite excedido (12 s)" : String(err.message || err)
    };
  } finally {
    clearTimeout(timer);
  }
}

const previousPath = path.join(outDir, "latest.json");
let previous = {};
try { previous = JSON.parse(await fs.readFile(previousPath, "utf8")); } catch {}

const results = await Promise.all(sites.map(async site => {
  const [home, sitemap, robots] = await Promise.all([
    check(site.url), check(site.sitemap), check(site.robots)
  ]);
  const sitemapLooksValid = sitemap.ok && /xml/i.test(sitemap.contentType || "") &&
    sitemap.xmlMarkerFound === true;
  return {
    ...site, checkedAt: new Date().toISOString(), home, sitemap, robots,
    sitemapLooksValid,
    issues: [
      ...(!home.ok ? ["site_indisponivel_ou_erro_http"] : []),
      ...(!sitemap.ok ? ["sitemap_nao_acessivel"] : []),
      ...(sitemap.ok && !sitemapLooksValid ? ["sitemap_resposta_precisa_ser_validada"] : []),
      ...(!robots.ok ? ["robots_txt_nao_acessivel"] : [])
    ],
    previousHomeOk: previous.sites?.find(x => x.id === site.id)?.home?.ok ?? null
  };
}));

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalSites: results.length,
    online: results.filter(x => x.home.ok).length,
    sitemapAccessible: results.filter(x => x.sitemap.ok).length,
    withIssues: results.filter(x => x.issues.length).length
  },
  sites: results
};
await fs.writeFile(previousPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));
for (const site of results) {
  console.log(`[${site.home.ok ? "OK" : "FALHA"}] ${site.name}: home=${site.home.status ?? site.home.note}; sitemap=${site.sitemap.status ?? site.sitemap.note}; issues=${site.issues.join(",") || "nenhum"}`);
}
