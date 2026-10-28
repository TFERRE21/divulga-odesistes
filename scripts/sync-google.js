import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sites = JSON.parse(await fs.readFile(path.join(ROOT, "config/sites.json"), "utf8"));
const outDir = path.join(ROOT, "data");
await fs.mkdir(outDir, { recursive: true });

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!raw) {
  console.log("Google sync ignorado: secret GOOGLE_SERVICE_ACCOUNT_JSON não configurado.");
  process.exit(0);
}

let serviceAccount;
try { serviceAccount = JSON.parse(raw); }
catch { throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON precisa conter o JSON válido da conta de serviço."); }
if (!serviceAccount.client_email || !serviceAccount.private_key) {
  throw new Error("A conta de serviço precisa conter client_email e private_key.");
}

const b64url = value => Buffer.from(value).toString("base64url");
async function getAccessToken(scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: scopes.join(" "),
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3500
  }));
  const unsigned = header + "." + claim;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), serviceAccount.private_key).toString("base64url");
  const assertion = unsigned + "." + signature;
  const response = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Google OAuth: " + (data.error_description || data.error || response.status));
  return data.access_token;
}

async function googleJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { authorization: "Bearer " + token, "content-type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Google API ${response.status}: ${body.error?.message || response.statusText}`);
  return body;
}
function propertyCandidates(site) {
  const host = new URL(site.url).hostname;
  return [site.url.replace(/\/$/, ""), "https://" + host + "/", "sc-domain:" + host, "https://www." + host + "/"];
}
async function findGscProperty(site, token) {
  const data = await googleJson("https://www.googleapis.com/webmasters/v3/sites", token);
  const properties = data.siteEntry || [];
  const candidates = propertyCandidates(site);
  return candidates.find(url => properties.some(p => p.siteUrl === url && p.permissionLevel !== "siteUnverifiedUser")) || null;
}
const end = new Date(Date.now() - 3 * 86400000);
const start = new Date(end.getTime() - 27 * 86400000);
const iso = d => d.toISOString().slice(0, 10);
const startDate = iso(start), endDate = iso(end);
const results = [];
let gscToken, gaToken;
try { gscToken = await getAccessToken(["https://www.googleapis.com/auth/webmasters.readonly"]); }
catch (e) { console.error("Falha de autenticação Search Console:", e.message); }
try { gaToken = await getAccessToken(["https://www.googleapis.com/auth/analytics.readonly"]); }
catch (e) { console.error("Falha de autenticação Analytics:", e.message); }

for (const site of sites) {
  const record = { id: site.id, name: site.name, url: site.url, period: { startDate, endDate }, syncedAt: new Date().toISOString() };
  if (gscToken) {
    try {
      const property = await findGscProperty(site, gscToken);
      if (!property) record.searchConsole = { status: "property_not_found_or_not_shared", note: "Adicione a conta de serviço como usuária da propriedade verificada no Search Console." };
      else {
        const data = await googleJson("https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(property) + "/searchAnalytics/query", gscToken, {
          method: "POST",
          body: JSON.stringify({ startDate, endDate, dimensions: [], rowLimit: 1, type: "web" })
        });
        const row = data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
        record.searchConsole = { status: "ok", property, clicks: row.clicks || 0, impressions: row.impressions || 0, ctr: row.ctr || 0, averagePosition: row.position || 0 };
      }
    } catch (e) { record.searchConsole = { status: "error", note: e.message }; }
  } else record.searchConsole = { status: "not_configured", note: "Credencial do Google indisponível." };

  if (gaToken) {
    try {
      const propertyId = process.env["GA4_PROPERTY_ID_" + site.id.toUpperCase().replace(/[^A-Z0-9]/g, "_")];
      if (!propertyId) record.analytics = { status: "property_id_missing", note: "Configure o ID GA4 específico deste site como secret." };
      else {
        const data = await googleJson(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, gaToken, {
          method: "POST",
          body: JSON.stringify({
            dateRanges: [{ startDate, endDate }],
            metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "screenPageViews" }],
            dimensions: []
          })
        });
        const vals = data.rows?.[0]?.metricValues || [];
        record.analytics = { status: "ok", propertyId, sessions: Number(vals[0]?.value || 0), users: Number(vals[1]?.value || 0), pageViews: Number(vals[2]?.value || 0) };
      }
    } catch (e) { record.analytics = { status: "error", note: e.message }; }
  } else record.analytics = { status: "not_configured", note: "Credencial do Google indisponível." };
  results.push(record);
}

const output = { generatedAt: new Date().toISOString(), period: { startDate, endDate }, configured: true, sites: results };
await fs.writeFile(path.join(outDir, "google-metrics.json"), JSON.stringify(output, null, 2) + "\n");
console.log("Sincronização Google concluída. Sites processados:", results.length);
for (const r of results) console.log(r.name, "GSC:", r.searchConsole?.status, "GA4:", r.analytics?.status);
