// Static landing page, llms.txt, robots.txt and sitemap.xml for ChainRead.
const ORIGIN = "https://chainread.imac2014ville.workers.dev";
const GH = "https://github.com/Imac2014Ville/baselens";
const BASELENS = "https://baselens.imac2014ville.workers.dev";
const TOKENGUARD = "https://tokenguard.imac2014ville.workers.dev";
const PAY_TO = "0xe2adAd422Fa4CC793b3e1f155e96864D01E77DA1";
const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_ETH = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const DESC = "ChainRead: cheap EVM reads for AI agents on Base and Ethereum: gas cost in USD, balances, ERC-20 metadata, contract and proxy inspection, tx status, ENS/Basename resolution. From $0.001 per call in USDC via x402, no API key.";

export const TOOLS = [
  { path: "/gas", price: "$0.001", what: "Gas price, priority fee suggestion and the cost of an ETH transfer, ERC-20 transfer and DEX swap in gwei, ETH and USD (Chainlink ETH/USD).", q: "chain=base" },
  { path: "/block", price: "$0.001", what: "Latest or any block: hash, timestamp, age, tx count, gas utilization, base fee.", q: "chain=ethereum&number=latest" },
  { path: "/balance", price: "$0.002", what: "Wallet balance: native ETH with USD value plus ERC-20 balances with symbol and decimals applied.", q: "chain=base&address=" + WETH + "&tokens=" + USDC },
  { path: "/erc20", price: "$0.002", what: "ERC-20 name, symbol, decimals, total supply, owner / renounced, proxy implementation.", q: "chain=base&token=" + USDC },
  { path: "/contract", price: "$0.002", what: "Contract or wallet? Code size, proxy detection (EIP-1967, beacon, EIP-1167), EIP-7702 delegation, well-known selectors and traits.", q: "chain=ethereum&address=" + USDC_ETH },
  { path: "/tx-status", price: "$0.001", what: "Transaction status (pending / success / failed), confirmations, gas used and fee in ETH and USD.", q: "chain=base&hash=0x…" },
  { path: "/resolve", price: "$0.002", what: "ENS (.eth) and Basename (.base.eth) to address via the on-chain registry and resolver.", q: "name=vitalik.eth" },
  { path: "/multicall-balances", price: "$0.005", what: "Up to 20 addresses in one Multicall3 call: native ETH or one ERC-20 for all of them, with total.", q: "chain=base&token=" + USDC + "&addresses=" + WETH + "," + USDC },
];

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function landingHtml() {
  const rows = TOOLS.map(t => `<tr><td><code>${t.path}</code></td><td>${t.price}</td><td>${esc(t.what)}</td></tr>`).join("");
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "WebAPI", name: "ChainRead", description: DESC, url: ORIGIN + "/", documentation: ORIGIN + "/openapi.json" });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ChainRead — cheap EVM read API for agents (Base + Ethereum)</title>
<meta name="description" content="${DESC}">
<link rel="canonical" href="${ORIGIN}/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="ChainRead">
<meta property="og:title" content="ChainRead — cheap EVM read API for agents (Base + Ethereum)">
<meta property="og:description" content="${DESC}"><meta property="og:url" content="${ORIGIN}/">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="ChainRead — cheap EVM read API for agents">
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
<header><h1>ChainRead</h1><p class="lead">Cheap on-chain reads for AI agents on Base and Ethereum mainnet. What will this transaction cost in USD, what is in this wallet, what is this token, is this address a proxy, did my tx land. $0.001 to $0.005 per call, no API key: pay in USDC on Base over <a href="https://x402.org">x402</a>.</p>
<p class="links"><a href="/openapi.json">OpenAPI</a><a href="/llms.txt">llms.txt</a><a href="https://www.x402scan.com/">x402scan</a><a href="${BASELENS}">BaseLens (more Base tools)</a><a href="${TOKENGUARD}">TokenGuard (token safety)</a><a href="${GH}">GitHub</a></p></header>
<h2>Why use it</h2>
<p>Agents need a handful of boring chain facts, constantly, and running or keying an RPC node for them is overhead. ChainRead answers each with one call and a clean JSON object: units already applied (decimals, gwei, USD), proxies and EIP-7702 delegations detected, many reads batched behind failover RPC providers. Every endpoint takes <code>chain</code> = <code>base</code> (default) or <code>ethereum</code>. Malformed requests return 400 and failed lookups return non-2xx, so you are not charged for them.</p>
<h2>Tools</h2>
<div class="tbl"><table><thead><tr><th>Endpoint</th><th>Price</th><th>What you get</th></tr></thead><tbody>${rows}</tbody></table></div>
<p>Every endpoint accepts <code>GET</code> with query params or <code>POST</code> with a JSON body.</p>
<h2>Example: the 402 flow with curl</h2>
<pre><code>$ curl -i "${ORIGIN}/gas?chain=base"
HTTP/2 402
payment-required: eyJ4NDAyVmVyc2lvbiI6Mi4uLn0=   # base64 JSON: scheme "exact", network eip155:8453,
                                                  # asset USDC, amount 1000 (= $0.001)
# An x402 client signs the payment, then retries with a PAYMENT-SIGNATURE header.</code></pre>
<h2>Example: JavaScript with @x402/fetch</h2>
<pre><code>import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.PRIVATE_KEY); // wallet holding USDC on Base
const pay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(signer) }],
});
const res = await pay("${ORIGIN}/gas?chain=ethereum");
console.log((await res.json()).estimates.dexSwap.costUsd);</code></pre>
<h2>Links</h2>
<ul><li><a href="/openapi.json">/openapi.json</a>: machine-readable spec with prices</li><li><a href="/.well-known/x402">/.well-known/x402</a>: resource list</li>
<li><a href="${BASELENS}">BaseLens</a>: wider Base toolkit (tx explainer, wallet snapshot, GPU prices, web-to-markdown)</li>
<li><a href="${TOKENGUARD}">TokenGuard</a>: honeypot and rug pull checks for Base tokens</li><li><a href="${GH}">Source on GitHub</a></li></ul>
<footer>Data comes from public RPC providers and is provided as-is, not financial advice. Payments settle in USDC on Base (eip155:8453) to ${PAY_TO}.</footer>
</main></body></html>`;
}

export function llmsTxt() {
  return `# ChainRead

> Cheap EVM read utilities for AI agents on Base and Ethereum mainnet: gas and USD transaction cost, blocks, balances, ERC-20 metadata, contract/proxy inspection, tx status, ENS/Basename resolution, bulk balances. From $0.001 per call in USDC on Base via x402. No API key.

Base URL: ${ORIGIN}
OpenAPI: ${ORIGIN}/openapi.json
Source: ${GH}
Related: BaseLens ${BASELENS}, TokenGuard ${TOKENGUARD}

## Endpoints (GET with query params, or POST with JSON body)
${TOOLS.map(t => `- ${t.path} (${t.price}): ${t.what} Example: ${t.path}?${t.q}`).join("\n")}

## How to pay
Call an endpoint without payment to receive HTTP 402 with a PAYMENT-REQUIRED header (base64 JSON: scheme exact, network eip155:8453, asset USDC). Use an x402 client (@x402/fetch, x402-axios, or an MCP x402 wallet) to sign and retry. Malformed requests return 400 and lookups that fail return non-2xx, so they are not charged.
`;
}

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
export const sitemapXml = () => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/openapi.json", "/llms.txt"].map(p => `<url><loc>${ORIGIN}${p}</loc></url>`).join("\n")}\n</urlset>\n`;
