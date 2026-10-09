// Static landing page, llms.txt, robots.txt and sitemap.xml for MacroLens.
const ORIGIN = "https://macrolens.imac2014ville.workers.dev";
const GH = "https://github.com/Imac2014Ville/baselens";
const PAY_TO = "0x587355795d50262347D8c23D0958C5187352544c";
const DESC = "MacroLens: global macro statistics (GDP, inflation, unemployment, debt and 30+ indicators for 200+ countries), country profiles, country rankings and official company registry lookups (Norway, France) for AI agents. Pay per call in USDC via x402, no API key.";

export const TOOLS = [
  { path: "/company", price: "$0.02", what: "Official company registry lookup by name or registry number: legal form, status, address, industry, employees; France adds officers and revenue/net income. Norway (Enhetsregisteret) and France (SIRENE/RNE).", q: "country=NO&query=Equinor" },
  { path: "/country-profile", price: "$0.01", what: "One-call economic snapshot of a country: latest GDP, GDP per capita, growth, inflation, unemployment, population, debt, current account, exports, imports, FDI, life expectancy, lending rate.", q: "country=JP" },
  { path: "/compare", price: "$0.01", what: "Rank up to 10 countries (or G7, BRICS, NORDICS) on one indicator using the latest available value of each.", q: "countries=G7&indicator=unemployment" },
  { path: "/indicator", price: "$0.005", what: "Time series for one country and one macro indicator (gdp, gdp_per_capita, gdp_growth, inflation, unemployment, population, debt_to_gdp, current_account, exports, imports, fdi, gini, life_expectancy and more), default last 10 years.", q: "country=US&indicator=gdp" },
];
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function landingHtml() {
  const rows = TOOLS.map(t => `<tr><td><code>${t.path}</code></td><td>${t.price}</td><td>${esc(t.what)}</td></tr>`).join("");
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "WebAPI", name: "MacroLens", description: DESC, url: ORIGIN + "/", documentation: ORIGIN + "/openapi.json" });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MacroLens — global macro data &amp; company registry API for agents</title>
<meta name="description" content="${DESC}">
<link rel="canonical" href="${ORIGIN}/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="MacroLens">
<meta property="og:title" content="MacroLens — global macro data &amp; company registry API for agents">
<meta property="og:description" content="${DESC}"><meta property="og:url" content="${ORIGIN}/">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="MacroLens — macro data &amp; company registries">
<meta name="twitter:description" content="${DESC}">
<script type="application/ld+json">${ld}</script>
<style>
:root{--bg:#fff;--fg:#14171f;--mut:#5b6472;--card:#f4f6fa;--bd:#dfe3ea;--ac:#0b7a5a}
@media(prefers-color-scheme:dark){:root{--bg:#0d1017;--fg:#e6e9ef;--mut:#98a1b0;--card:#161b24;--bd:#262d3a;--ac:#4fd1a5}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}h1{font-size:2rem;margin:.2em 0}h2{margin-top:2.2em;font-size:1.3rem}
p.lead{color:var(--mut);font-size:1.1rem}a{color:var(--ac)}code,pre{font:13.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
pre{background:var(--card);border:1px solid var(--bd);border-radius:8px;padding:12px 14px;overflow-x:auto}
code{background:var(--card);padding:1px 5px;border-radius:4px}pre code{background:none;padding:0}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--bd);vertical-align:top}
.links a{display:inline-block;margin:0 14px 8px 0}.tbl{overflow-x:auto}footer{margin-top:3em;color:var(--mut);font-size:.9rem}
</style></head><body><main>
<header><h1>MacroLens</h1><p class="lead">Global macro statistics and official company registry lookups for AI agents. Ask for GDP, inflation or unemployment of almost any country, rank countries against each other, or verify a Norwegian or French company in one call. No API key: pay in USDC on Base per call over <a href="https://x402.org">x402</a>.</p>
<p class="links"><a href="/openapi.json">OpenAPI</a><a href="/llms.txt">llms.txt</a><a href="https://www.x402scan.com/">x402scan</a><a href="${GH}">GitHub</a></p></header>
<h2>Tools</h2>
<div class="tbl"><table><thead><tr><th>Endpoint</th><th>Price</th><th>What you get</th></tr></thead><tbody>${rows}</tbody></table></div>
<p>Every endpoint accepts <code>GET</code> with query params or <code>POST</code> with a JSON body. Country accepts ISO2 or ISO3 (<code>US</code>, <code>DEU</code>); aggregates such as <code>WLD</code> or <code>EUU</code> work too. Unknown countries, empty lookups and upstream failures return non-2xx, so you are not charged.</p>
<h2>Example: the 402 flow with curl</h2>
<pre><code>$ curl -i "${ORIGIN}/indicator?country=US&amp;indicator=gdp"
HTTP/2 402
payment-required: eyJ4NDAyVmVyc2lvbiI6Mi4uLn0=   # base64 JSON: scheme "exact", network eip155:8453,
                                                  # asset USDC, amount 5000 (= $0.005)
# An x402 client signs the payment, then retries with a PAYMENT-SIGNATURE header.</code></pre>
<h2>Example: JavaScript with @x402/fetch</h2>
<pre><code>import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.PRIVATE_KEY); // wallet holding USDC on Base
const pay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer) }],
});
const res = await pay("${ORIGIN}/compare?countries=G7&amp;indicator=unemployment");
console.log(await res.json()); // ranking[].country, value, year</code></pre>
<h2>Data sources and attributions</h2>
<ul>
<li><b>World Bank Open Data</b> (indicators, profiles, comparisons): licensed <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Source: World Bank, World Development Indicators and related databases. Values are annual and may lag by one or more years.</li>
<li><b>Brønnøysund Register Centre, Enhetsregisteret</b> (Norway): published under the Norwegian Licence for Open Government Data (<a href="https://data.norge.no/nlod/en/2.0">NLOD 2.0</a>).</li>
<li><b>Recherche d'entreprises / SIRENE / RNE</b> (France): published by the French government under the <a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/">Licence Ouverte 2.0</a>.</li>
</ul>
<p>MacroLens does not use IMF DataMapper because IMF terms require permission for commercial reuse. UK Companies House requires an API key, so the UK is not covered.</p>
<h2>Links</h2>
<ul><li><a href="/openapi.json">/openapi.json</a>: machine-readable spec with prices</li><li><a href="/.well-known/x402">/.well-known/x402</a>: resource list</li><li><a href="${GH}">Source on GitHub</a></li></ul>
<footer>Statistics are republished from official sources and cached for up to one hour; not financial or legal advice. Payments settle in USDC on Base (eip155:8453) to ${PAY_TO}.</footer>
</main></body></html>`;
}

export function llmsTxt() {
  return `# MacroLens

> Global macro statistics (World Bank) and official company registry lookups (Norway, France) for AI agents. Pay per call in USDC on Base via x402. No API key.

Base URL: ${ORIGIN}
OpenAPI: ${ORIGIN}/openapi.json
Source: ${GH}

## Endpoints (GET with query params, or POST with JSON body)
${TOOLS.map(t => `- ${t.path} (${t.price}): ${t.what} Example: ${t.path}${t.q ? "?" + t.q : ""}`).join("\n")}

## Sources
World Bank Open Data (CC BY 4.0), Brønnøysund Enhetsregisteret (NLOD), Recherche d'entreprises/SIRENE (Licence Ouverte 2.0).

## How to pay
Call an endpoint without payment to receive HTTP 402 with a PAYMENT-REQUIRED header (base64 JSON: scheme exact, network eip155:8453, asset USDC). Use an x402 client (@x402/fetch, x402-axios, or an MCP x402 wallet) to sign and retry. Malformed requests return 400 and lookups that fail return non-2xx, so they are not charged.
`;
}
export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
export const sitemapXml = () => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/openapi.json", "/llms.txt"].map(p => `<url><loc>${ORIGIN}${p}</loc></url>`).join("\n")}\n</urlset>\n`;
