// Static landing page, llms.txt, robots.txt and sitemap.xml for SkyFeed.
const ORIGIN = "https://skyfeed.imac2014ville.workers.dev";
const GH = "https://github.com/Imac2014Ville/baselens";
const PAY_TO = "0x7ab8a8d4DD4a37FAaEB4d0EEaDc53B74eb00C283";
const DESC = "SkyFeed: pay-per-call weather for AI agents. Hourly forecasts and current conditions worldwide, US severe-weather alerts, earthquakes, public holidays and a bundled travel check. Pay in USDC via x402, no API key.";

export const TOOLS = [
  { path: "/forecast", price: "$0.005", what: "Hourly forecast for the next 1-48 hours at a city or lat/lon: temperature, wind, precipitation, humidity, cloud cover, weather symbol, plus a summary.", q: "city=Tokyo&hours=24" },
  { path: "/current", price: "$0.003", what: "Current conditions (model nowcast for this hour) at a city or lat/lon.", q: "city=London" },
  { path: "/alerts", price: "$0.005", what: "Active US National Weather Service alerts by state or lat/lon, sorted by severity, with timing and instructions.", q: "state=FL" },
  { path: "/earthquakes", price: "$0.003", what: "Recent USGS earthquakes by minimum magnitude and window (up to 168 h), optionally within a radius of a point.", q: "minMagnitude=5&hours=72" },
  { path: "/holidays", price: "$0.002", what: "Public holidays for a country (ISO2) and year, with local names and regional scope.", q: "country=DE&year=2026" },
  { path: "/travel-check", price: "$0.01", what: "Trip-day bundle for a city: that day's weather, holidays within 3 days, quakes within 300 km in the past week, and risk flags.", q: "city=Rome&date=2026-10-12" },
];
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function landingHtml() {
  const rows = TOOLS.map(t => `<tr><td><code>${t.path}</code></td><td>${t.price}</td><td>${esc(t.what)}</td></tr>`).join("");
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "WebAPI", name: "SkyFeed", description: DESC, url: ORIGIN + "/", documentation: ORIGIN + "/openapi.json" });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SkyFeed — weather, alerts &amp; hazard data API for agents</title>
<meta name="description" content="${DESC}">
<link rel="canonical" href="${ORIGIN}/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="SkyFeed">
<meta property="og:title" content="SkyFeed — weather, alerts &amp; hazard data API for agents">
<meta property="og:description" content="${DESC}"><meta property="og:url" content="${ORIGIN}/">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="SkyFeed — weather &amp; hazard data for agents">
<meta name="twitter:description" content="${DESC}">
<script type="application/ld+json">${ld}</script>
<style>
:root{--bg:#fff;--fg:#14171f;--mut:#5b6472;--card:#f4f6fa;--bd:#dfe3ea;--ac:#1565c0}
@media(prefers-color-scheme:dark){:root{--bg:#0d1017;--fg:#e6e9ef;--mut:#98a1b0;--card:#161b24;--bd:#262d3a;--ac:#64b5f6}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}h1{font-size:2rem;margin:.2em 0}h2{margin-top:2.2em;font-size:1.3rem}
p.lead{color:var(--mut);font-size:1.1rem}a{color:var(--ac)}code,pre{font:13.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
pre{background:var(--card);border:1px solid var(--bd);border-radius:8px;padding:12px 14px;overflow-x:auto}
code{background:var(--card);padding:1px 5px;border-radius:4px}pre code{background:none;padding:0}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--bd);vertical-align:top}
.links a{display:inline-block;margin:0 14px 8px 0}.tbl{overflow-x:auto}footer{margin-top:3em;color:var(--mut);font-size:.9rem}
</style></head><body><main>
<header><h1>SkyFeed</h1><p class="lead">Weather and hazard data for AI agents. Get an hourly forecast anywhere on Earth, check active US severe-weather alerts, list recent earthquakes, look up public holidays, or run a one-call travel check. No API key: pay in USDC on Base per call over <a href="https://x402.org">x402</a>.</p>
<p class="links"><a href="/openapi.json">OpenAPI</a><a href="/llms.txt">llms.txt</a><a href="https://www.x402scan.com/">x402scan</a><a href="${GH}">GitHub</a></p></header>
<h2>Tools</h2>
<div class="tbl"><table><thead><tr><th>Endpoint</th><th>Price</th><th>What you get</th></tr></thead><tbody>${rows}</tbody></table></div>
<p>Every endpoint accepts <code>GET</code> with query params or <code>POST</code> with a JSON body. Locations: pass <code>lat</code> and <code>lon</code>, or <code>city</code> for any of about 260 built-in major cities (no external geocoder). Invalid input returns 400 before payment; unknown places and upstream failures return non-2xx, so you are not charged.</p>
<h2>Example: the 402 flow with curl</h2>
<pre><code>$ curl -i "${ORIGIN}/forecast?city=Tokyo&amp;hours=24"
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
const res = await pay("${ORIGIN}/travel-check?city=Rome");
console.log(await res.json()); // weather, holidays, nearbyQuakes, riskFlags</code></pre>
<h2>Data sources and attributions</h2>
<ul>
<li><b>Weather forecasts</b>: data from <a href="https://api.met.no/">MET Norway</a> (Locationforecast), licensed <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> (<a href="https://api.met.no/doc/License">license terms</a>). Values are reprocessed (units, hourly selection, summaries).</li>
<li><b>Severe-weather alerts</b>: <a href="https://www.weather.gov/">US National Weather Service</a> (api.weather.gov), US government work in the public domain.</li>
<li><b>Earthquakes</b>: <a href="https://earthquake.usgs.gov/">USGS Earthquake Hazards Program</a> real-time feeds, public domain.</li>
<li><b>Public holidays</b>: <a href="https://date.nager.at/">Nager.Date</a>, open-source (MIT) public-holiday API.</li>
<li><b>Cities</b>: built-in table of coordinates for about 260 major cities.</li>
</ul>
<p>SkyFeed does not use Open-Meteo, whose free tier is for non-commercial use only. Forecasts are model output, not official warnings: for life-safety decisions consult your national weather service.</p>
<h2>Links</h2>
<ul><li><a href="/openapi.json">/openapi.json</a>: machine-readable spec with prices</li><li><a href="/.well-known/x402">/.well-known/x402</a>: resource list</li><li><a href="${GH}">Source on GitHub</a></li></ul>
<footer>Responses are cached for 5 to 60 minutes; not a substitute for official warnings. Payments settle in USDC on Base (eip155:8453) to ${PAY_TO}.</footer>
</main></body></html>`;
}

export function llmsTxt() {
  return `# SkyFeed

> Weather forecasts (global), current conditions, US severe-weather alerts, earthquakes, public holidays and a bundled travel check for AI agents. Pay per call in USDC on Base via x402. No API key.

Base URL: ${ORIGIN}
OpenAPI: ${ORIGIN}/openapi.json
Source: ${GH}

## Endpoints (GET with query params, or POST with JSON body)
${TOOLS.map(t => `- ${t.path} (${t.price}): ${t.what} Example: ${t.path}${t.q ? "?" + t.q : ""}`).join("\n")}

## Sources
MET Norway Locationforecast (CC BY 4.0), US National Weather Service (public domain), USGS Earthquake Hazards Program (public domain), Nager.Date (MIT).

## How to pay
Call an endpoint without payment to receive HTTP 402 with a PAYMENT-REQUIRED header (base64 JSON: scheme exact, network eip155:8453, asset USDC). Use an x402 client (@x402/fetch, x402-axios, or an MCP x402 wallet) to sign and retry. Malformed requests return 400 and lookups that fail return non-2xx, so they are not charged.
`;
}
export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
export const sitemapXml = () => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/openapi.json", "/llms.txt"].map(p => `<url><loc>${ORIGIN}${p}</loc></url>`).join("\n")}\n</urlset>\n`;
