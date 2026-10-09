// Static landing page, llms.txt, robots.txt and sitemap.xml for TokenGuard Base.
const ORIGIN = "https://tokenguard.imac2014ville.workers.dev";
const GH = "https://github.com/Imac2014Ville/baselens";
const BASELENS = "https://baselens.imac2014ville.workers.dev";
const DEPVET = "https://depvet.imac2014ville.workers.dev";
const PAY_TO = "0xe296A4dfee08FF48938df20300D4B7CF957B1F04";
const BRETT = "0x532f27101965dd16442E59d40670FaF5eBB142E4";
const DESC = "TokenGuard Base: honeypot check, rug pull check and scam token detector for Base tokens, plus new token launches pre-screened for honeypots. Pay per call in USDC via x402, no API key.";

export const TOOLS = [
  { path: "/launch-scan", price: "$0.03", what: "New token launches on Base pre-screened for honeypots: every new pool annotated with verdict, risk score and flags. Sniper safety in one call.", q: "minutes=30&quote=weth&limit=5" },
  { path: "/token-risk", price: "$0.02", what: "Honeypot check and rug pull check for one Base token: simulated sell, owner powers (mint, blacklist, pause, fees, proxy), liquidity, LP burn; verdict + 0-100 risk score.", q: "token=" + BRETT },
  { path: "/new-pools", price: "$0.01", what: "New token launches on Base (Uniswap v2/v3/v4, Aerodrome) with price, liquidity and flags. Raw feed, no screening.", q: "minutes=30&quote=weth" },
];

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function landingHtml() {
  const rows = TOOLS.map(t => `<tr><td><code>${t.path}</code></td><td>${t.price}</td><td>${esc(t.what)}</td></tr>`).join("");
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "WebAPI", name: "TokenGuard Base", description: DESC, url: ORIGIN + "/", documentation: ORIGIN + "/openapi.json" });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TokenGuard Base — honeypot &amp; rug pull check for Base tokens</title>
<meta name="description" content="${DESC}">
<link rel="canonical" href="${ORIGIN}/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="TokenGuard Base">
<meta property="og:title" content="TokenGuard Base — honeypot &amp; rug pull check for Base tokens">
<meta property="og:description" content="${DESC}"><meta property="og:url" content="${ORIGIN}/">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="TokenGuard Base — honeypot &amp; rug pull check">
<meta name="twitter:description" content="${DESC}">
<script type="application/ld+json">${ld}</script>
<style>
:root{--bg:#fff;--fg:#14171f;--mut:#5b6472;--card:#f4f6fa;--bd:#dfe3ea;--ac:#0052ff}
@media(prefers-color-scheme:dark){:root{--bg:#0d1017;--fg:#e6e9ef;--mut:#98a1b0;--card:#161b24;--bd:#262d3a;--ac:#6b9bff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}h1{font-size:2rem;margin:.2em 0}h2{margin-top:2.2em;font-size:1.3rem}
p.lead{color:var(--mut);font-size:1.1rem}a{color:var(--ac)}code,pre{font:13.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
pre{background:var(--card);border:1px solid var(--bd);border-radius:8px;padding:12px 14px;overflow-x:auto}
code{background:var(--card);padding:1px 5px;border-radius:4px}pre code{background:none;padding:0}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--bd);vertical-align:top}
.links a{display:inline-block;margin:0 14px 8px 0}.tbl{overflow-x:auto}footer{margin-top:3em;color:var(--mut);font-size:.9rem}
</style></head><body><main>
<header><h1>TokenGuard Base</h1><p class="lead">Is this Base token safe? Honeypot check, rug pull check and scam token detector for AI agents and trading bots, plus new token launches pre-screened for honeypots. No API key: pay in USDC on Base per call over <a href="https://x402.org">x402</a>.</p>
<p class="links"><a href="/openapi.json">OpenAPI</a><a href="/llms.txt">llms.txt</a><a href="https://www.x402scan.com/">x402scan</a><a href="${BASELENS}">BaseLens (more Base tools)</a><a href="${DEPVET}">DepVet (dependency vetting)</a><a href="${GH}">GitHub</a></p></header>
<h2>What it checks</h2>
<p>Before a bot buys a token, TokenGuard simulates a sell into the main pool (honeypot detection), reads the bytecode for owner powers (mint, blacklist, pause, fee changes, upgradeable proxy), measures liquidity and LP burn, and checks who holds the supply. You get a verdict (<code>LOW_RISK</code>, <code>CAUTION</code>, <code>HIGH_RISK</code>, <code>AVOID</code>), a 0-100 risk score and the exact flags behind it. <code>/launch-scan</code> does this for every fresh launch, so a sniper sees only what survived screening. Failed lookups are not charged.</p>
<h2>Tools</h2>
<div class="tbl"><table><thead><tr><th>Endpoint</th><th>Price</th><th>What you get</th></tr></thead><tbody>${rows}</tbody></table></div>
<p>Every endpoint accepts <code>GET</code> with query params or <code>POST</code> with a JSON body.</p>
<h2>Example: the 402 flow with curl</h2>
<pre><code>$ curl -i "${ORIGIN}/token-risk?token=${BRETT}"
HTTP/2 402
payment-required: eyJ4NDAyVmVyc2lvbiI6Mi4uLn0=   # base64 JSON: scheme "exact", network eip155:8453,
                                                  # asset USDC, amount 20000 (= $0.02)
# An x402 client signs the payment, then retries with a PAYMENT-SIGNATURE header.</code></pre>
<h2>Example: JavaScript with @x402/fetch</h2>
<pre><code>import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.PRIVATE_KEY); // wallet holding USDC on Base
const pay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer) }],
});
const res = await pay("${ORIGIN}/launch-scan?minutes=30&amp;limit=5");
console.log(await res.json()); // pools[].verdict, pools[].riskScore, pools[].flags</code></pre>
<h2>Links</h2>
<ul><li><a href="/openapi.json">/openapi.json</a>: machine-readable spec with prices</li><li><a href="/.well-known/x402">/.well-known/x402</a>: resource list</li>
<li><a href="${BASELENS}">BaseLens</a>: wider Base toolkit (tx explainer, wallet snapshot, GPU prices, web-to-markdown)</li>
<li><a href="${DEPVET}">DepVet</a>: pay-per-call dependency vetting</li><li><a href="${GH}">Source on GitHub</a></li></ul>
<footer>Automated on-chain heuristics, not financial advice. Payments settle in USDC on Base (eip155:8453) to ${PAY_TO}.</footer>
</main></body></html>`;
}

export function llmsTxt() {
  return `# TokenGuard Base

> Honeypot check, rug pull check and scam token detector for Base tokens, plus new token launches pre-screened for honeypots. Pay per call in USDC on Base via x402. No API key.

Base URL: ${ORIGIN}
OpenAPI: ${ORIGIN}/openapi.json
Source: ${GH}
Related: BaseLens ${BASELENS}, DepVet ${DEPVET}

## Endpoints (GET with query params, or POST with JSON body)
${TOOLS.map(t => `- ${t.path} (${t.price}): ${t.what} Example: ${t.path}?${t.q}`).join("\n")}

## How to pay
Call an endpoint without payment to receive HTTP 402 with a PAYMENT-REQUIRED header (base64 JSON: scheme exact, network eip155:8453, asset USDC). Use an x402 client (@x402/fetch, x402-axios, or an MCP x402 wallet) to sign and retry. Malformed requests return 400 and lookups that fail return non-2xx, so they are not charged.
`;
}

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
export const sitemapXml = () => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/openapi.json", "/llms.txt"].map(p => `<url><loc>${ORIGIN}${p}</loc></url>`).join("\n")}\n</urlset>\n`;
