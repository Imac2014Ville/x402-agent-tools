// ChainRead — cheap pay-per-call EVM read utilities for AI agents on Base and Ethereum mainnet (x402, USDC on Base).
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { landingHtml, llmsTxt, robotsTxt, sitemapXml } from "./landing.js";
import { FailoverFacilitatorClient } from "./facilitator.js";
import { gas, block, balance, erc20, contract, txStatus, resolve, multicallBalances } from "./reads.js";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";

const PAY_TO = "0xe2adAd422Fa4CC793b3e1f155e96864D01E77DA1";
const NETWORK = "eip155:8453";
const SERVICE = "ChainRead";
const isAddr = a => /^0x[0-9a-fA-F]{40}$/.test(a || "");
const WETH = "0x4200000000000000000000000000000000000006", USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH_ETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

// ---------- app ----------
const app = new Hono();
const server = new x402ResourceServer(new FailoverFacilitatorClient())
  .register(NETWORK, new ExactEvmScheme());
server.registerExtension(bazaarResourceServerExtension);

const route = (description, input, inputSchema, example, price) => ({
  accepts: { scheme: "exact", price, network: NETWORK, payTo: PAY_TO },
  description, mimeType: "application/json",
  extensions: declareDiscoveryExtension({ input, inputSchema, output: { example } }),
});

const CHAIN_PROP = { chain: { type: "string", enum: ["base", "ethereum"], description: "Chain to read (default base)" } };
const ADDR = d => ({ type: "string", description: d });
const ROUTES = {
  "GET /gas": route("Current gas price and fee suggestion on Base or Ethereum: base fee, priority fee (low/standard/fast), max fee to set, and what an ETH transfer, ERC-20 transfer and DEX swap cost right now in gwei, ETH and USD (Chainlink ETH/USD). Know what a transaction costs before you send it.",
    { chain: "base" }, { type: "object", properties: { ...CHAIN_PROP } },
    { ok: true, chain: "base", baseFeeGwei: 0.0053, priorityFeeGwei: { low: 0.001, standard: 0.0012, fast: 0.002 }, ethUsd: 2450.3, estimates: { ethTransfer: { gasUnits: 21000, costEth: 0.00000012, costUsd: 0.0003 } } }, "$0.001"),
  "GET /block": route("Latest block or any block by number on Base or Ethereum: hash, timestamp, age in seconds, transaction count, gas used and utilization, base fee. Cheap chain-head and block lookup for agents.",
    { chain: "base" }, { type: "object", properties: { ...CHAIN_PROP, number: { type: "string", description: "Block number (decimal or 0x hex) or latest (default latest)" } } },
    { ok: true, chain: "base", number: 41000000, hash: "0xabc…", ageSeconds: 1, txCount: 118, gasUtilizationPct: 22.4, baseFeeGwei: 0.0053 }, "$0.001"),
  "GET /balance": route("Wallet balance check on Base or Ethereum: native ETH (with USD value) plus ERC-20 token balances with symbol and decimals already applied. Pass your own token list or get the common ones (USDC, WETH, ...).",
    { chain: "base", address: WETH, tokens: [USDC] }, { type: "object", properties: { ...CHAIN_PROP, address: ADDR("Wallet or contract address (0x…)"), tokens: { type: "array", items: { type: "string" }, description: "ERC-20 addresses, max 20 (GET: comma-separated; default: common tokens)" } }, required: ["address"] },
    { ok: true, chain: "base", address: WETH, native: { balance: "1523.4", usd: 3732000 }, tokens: [{ symbol: "USDC", decimals: 6, balance: "5120.33" }] }, "$0.002"),
  "GET /erc20": route("ERC-20 token metadata on Base or Ethereum in one call: name, symbol, decimals, total supply, owner (and whether ownership is renounced), and proxy/upgradeable implementation address.",
    { chain: "base", token: USDC }, { type: "object", properties: { ...CHAIN_PROP, token: ADDR("ERC-20 contract address (0x…)") }, required: ["token"] },
    { ok: true, chain: "base", token: USDC, name: "USD Coin", symbol: "USDC", decimals: 6, totalSupply: "4100000000", isProxy: true, proxyKind: "EIP-1967", implementation: "0x2ce6311ddae708829bc0784c967b7d77d19fd779" }, "$0.002"),
  "GET /contract": route("Inspect any address on Base or Ethereum: is it a contract or a wallet, code size, proxy detection (EIP-1967, beacon, EIP-1167), EIP-7702 delegation detection, and which well-known function selectors it implements (ERC-20/721/1155, ownable, mintable, pausable, upgradeable, multicall).",
    { chain: "base", address: WETH }, { type: "object", properties: { ...CHAIN_PROP, address: ADDR("Address to inspect (0x…)") }, required: ["address"] },
    { ok: true, chain: "base", address: WETH, isContract: true, codeSize: 2200, isProxy: false, traits: ["erc20-like"], selectorsOfInterest: [{ selector: "0xa9059cbb", signature: "transfer(address,uint256)" }] }, "$0.002"),
  "GET /tx-status": route("Transaction status lookup on Base or Ethereum: pending, success or failed, confirmations, block, from/to, gas used and the fee paid in ETH and USD (including Base L1 data fee).",
    { chain: "base", hash: "0x…(64 hex)" }, { type: "object", properties: { ...CHAIN_PROP, hash: ADDR("Transaction hash (0x + 64 hex)") }, required: ["hash"] },
    { ok: true, chain: "base", status: "success", confirmations: 12, gasUsed: 51234, feeEth: 0.0000021, feeUsd: 0.005 }, "$0.001"),
  "GET /resolve": route("Resolve an ENS name (.eth, on Ethereum) or a Basename (.base.eth, on Base) to its wallet address through the on-chain registry and resolver. Returns the resolver used.",
    { name: "jesse.base.eth" }, { type: "object", properties: { name: ADDR("ENS name or Basename, e.g. vitalik.eth or jesse.base.eth") }, required: ["name"] },
    { ok: true, name: "jesse.base.eth", address: "0x849151d7D0bF1F34b70d5caD5149D28CC2308bf1", resolvedOn: "base" }, "$0.002"),
  "GET /multicall-balances": route("Bulk balance check for up to 20 addresses on Base or Ethereum in a single Multicall3 call: native ETH, or one ERC-20 token for all addresses. Returns per-address balances and the total.",
    { chain: "base", addresses: [WETH, USDC], token: USDC }, { type: "object", properties: { ...CHAIN_PROP, addresses: { type: "array", items: { type: "string" }, description: "1-20 addresses (GET: comma-separated)" }, token: ADDR("Optional ERC-20 address; omit for native ETH") }, required: ["addresses"] },
    { ok: true, chain: "base", asset: { symbol: "USDC", decimals: 6 }, count: 2, total: "1234.5", balances: [{ address: WETH, balance: "1000" }] }, "$0.005"),
};
const ORIGIN = "https://chainread.imac2014ville.workers.dev";
// x402scan/agentcash ownership proofs: EIP-191 signatures of this ORIGIN string by the payTo wallet (overseer fills).
const OWNERSHIP_PROOFS = ["0xacf53d18bee5738e940dfcb7a53cfb6253553b15faa2467b9171742a3f1dd18e63bc561c2e045bb6e8d2739749eed17a58d5e9dfdf185638e4e5223a65073d431c"];
const SUMMARY = { "/gas": "Gas price and transaction cost in USD (Base, Ethereum)", "/block": "Latest or specific block (Base, Ethereum)", "/balance": "ETH + ERC-20 wallet balances", "/erc20": "ERC-20 token metadata, owner, proxy", "/contract": "Contract vs wallet, proxy, EIP-7702, selectors", "/tx-status": "Transaction status, confirmations, fee", "/resolve": "ENS and Basename to address", "/multicall-balances": "Bulk balances for up to 20 addresses" };
const TAGS = {
  "/gas": ["gas", "gas-price", "fees", "base", "ethereum"], "/block": ["block", "rpc", "base", "ethereum"], "/balance": ["balance", "wallet", "erc20", "base", "ethereum"],
  "/erc20": ["erc20", "token", "metadata", "base", "ethereum"], "/contract": ["contract", "proxy", "eip-7702", "base", "ethereum"], "/tx-status": ["transaction", "receipt", "base", "ethereum"],
  "/resolve": ["ens", "basename", "resolve", "base", "ethereum"], "/multicall-balances": ["multicall", "balances", "bulk", "base", "ethereum"],
};
for (const k of Object.keys(ROUTES)) {
  const r = ROUTES[k], path = k.split(" ")[1];
  ROUTES["POST " + path] = { ...r, extensions: declareDiscoveryExtension({ bodyType: "json", input: r.extensions.bazaar.info.input.queryParams,
    inputSchema: r.extensions.bazaar.schema.properties.input.properties.queryParams, output: { example: r.extensions.bazaar.info.output.example } }) };
}
for (const [k, r] of Object.entries(ROUTES)) {
  const path = k.split(" ")[1];
  Object.assign(r, { resource: ORIGIN + path, serviceName: SERVICE, tags: TAGS[path], iconUrl: ORIGIN + "/favicon.svg" });
}

// Workers forbid I/O at global scope and sharing promises across requests, so the
// facilitator sync runs inside whichever request gets there first, until it succeeds.
let paywall, synced = false;
const params = async c => { const p = c.req.method === "POST" ? await c.req.json().catch(() => null) : c.req.query(); return p && typeof p === "object" && !Array.isArray(p) ? p : {}; };
const CHAIN_ALIAS = { base: "base", ethereum: "ethereum", eth: "ethereum", mainnet: "ethereum", "ethereum-mainnet": "ethereum", "base-mainnet": "base" };
const chainOf = p => CHAIN_ALIAS[String(p.chain ?? "base").toLowerCase() || "base"];
// list params: JSON array (POST) or comma/space separated string (GET)
const listOf = v => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,]+/) : v === undefined || v === null || v === "" ? [] : [v]).map(x => (typeof x === "string" ? x.trim() : x)).filter(x => x !== "");
// Returns an error string for invalid input, else null. Runs BEFORE the paywall so buyers are never charged for a 400.
function validate(path, p) {
  if (p.chain !== undefined && p.chain !== "" && !chainOf(p)) return "chain must be base or ethereum";
  const needAddr = k => (isAddr(p[k]) ? null : `pass ${k}=0x…(40 hex)`);
  switch (path) {
    case "/gas": return null;
    case "/block": {
      const n = p.number; if (n === undefined || n === "" || n === null) return null;
      const s = String(n).toLowerCase();
      return ["latest", "finalized", "safe"].includes(s) || (/^(0x[0-9a-f]{1,14}|\d{1,15})$/.test(s)) ? null : "number must be a block number (decimal or 0x hex) or latest";
    }
    case "/balance": {
      const e = needAddr("address"); if (e) return e;
      const t = listOf(p.tokens); if (t.length > 20) return "tokens: max 20"; return t.every(isAddr) ? null : "tokens must be ERC-20 addresses (0x…40 hex)";
    }
    case "/erc20": return needAddr("token");
    case "/contract": return needAddr("address");
    case "/tx-status": return /^0x[0-9a-fA-F]{64}$/.test(p.hash || "") ? null : "pass hash=0x…(64 hex)";
    case "/resolve": { const n = String(p.name ?? "").trim(); return n.length > 0 && n.length <= 255 && /^[^\s.][^\s]*\.eth$/i.test(n) && !n.includes("..") ? null : "pass name ending in .eth (e.g. vitalik.eth) or .base.eth (a Basename)"; }
    case "/multicall-balances": {
      const a = listOf(p.addresses); if (!a.length) return "pass addresses=0x…,0x… (1-20)"; if (a.length > 20) return "addresses: max 20";
      if (!a.every(isAddr)) return "addresses must be 0x…(40 hex)";
      return p.token === undefined || p.token === "" || isAddr(p.token) ? null : "token must be an ERC-20 address (0x…40 hex) or omitted for native ETH";
    }
  }
  return null;
}
// Failed lookups return non-2xx so the x402 middleware cancels settlement (buyer is not charged).
function failStatus(r) {
  if (r.found === false) return 404;
  if (r.ok !== false) return 200;
  const e = String(r.error || "");
  if (/no contract at this address/.test(e)) return 404;
  if (/not an ERC-20|not supported/.test(e)) return 422;
  if (/timeout|timed out|aborted/i.test(e)) return 504;
  return 502;
}
// Zero-parameter requests (sweeper buyers) get a default example instead of a 400; see DEFAULTS.
const withD = (c, r) => (c.get("dflt") && r && typeof r === "object" ? { ...r, defaultsUsed: c.get("dflt") } : r);
const respond = (c, r) => c.json(withD(c, r), failStatus(r));
const dnote = k => `No parameters supplied; returning a default example (chain base). Pass ${k} to query your own.`;
const DEFAULTS = {
  "/gas": {}, "/block": {}, "/tx-status": {}, // tx-status default = first tx of the latest block
  "/balance": { address: WETH }, "/erc20": { token: USDC }, "/contract": { address: WETH }, "/resolve": { name: "jesse.base.eth" },
  "/multicall-balances": { addresses: [WETH, USDC], token: USDC },
};

app.use(async (c, next) => {
  const path = c.req.path;
  if ((c.req.method === "GET" || c.req.method === "POST") && ROUTES[`${c.req.method} ${path}`]) {
    let p = await params(c);
    // No params at all (paid or not): skip validation, use DEFAULTS so the paywall settles and the buyer gets a useful example.
    // Params present but malformed still 400 here, BEFORE the paywall, so nobody pays for a bad request.
    if (!Object.keys(p).length && DEFAULTS[path]) {
      p = { ...DEFAULTS[path] };
      c.set("dflt", { chain: "base", ...DEFAULTS[path], note: dnote(Object.keys(DEFAULTS[path]).join(" / ") || "chain, number, hash") });
    } else { const err = Object.keys(p).length ? validate(path, p) : null; if (err) return c.json({ error: err }, 400); }
    c.set("p", p);
  }
  if (c.env?.DEV_FREE === "1") return next(); // local testing only (wrangler dev --var DEV_FREE:1); never set in production
  if (!synced && ROUTES[`${c.req.method} ${c.req.path}`]) { await server.initialize(); synced = true; }
  paywall ??= paymentMiddleware(ROUTES, server, undefined, undefined, false);
  return withV1(c, next);
});

// ---- x402 v1 client compatibility (X-PAYMENT header, network "base", body-borne challenge) ----
// @x402/core's resource server is v2-only, so: (1) every 402 also carries a v1-shaped JSON body (v2 clients read the
// PAYMENT-REQUIRED header first and ignore the body); (2) a v1 X-PAYMENT payload is rewritten into an equivalent v2
// PAYMENT-SIGNATURE (EIP-3009 authorization+signature are identical across versions) before the normal paywall runs.
const b64j = o => btoa(JSON.stringify(o)), unb64j = s => JSON.parse(atob(s));
const V1_NET = { "eip155:8453": "base" };
function v1Body(h) {
  let pr; try { pr = unb64j(h); } catch { return null; }
  const accepts = (pr.accepts || []).filter(a => V1_NET[a.network]).map(a => ({
    scheme: a.scheme, network: V1_NET[a.network], maxAmountRequired: a.amount, resource: pr.resource?.url, description: pr.resource?.description ?? "",
    mimeType: pr.resource?.mimeType ?? "application/json", payTo: a.payTo, maxTimeoutSeconds: a.maxTimeoutSeconds, asset: a.asset, extra: a.extra }));
  return accepts.length ? { x402Version: 1, error: pr.error ?? "X-PAYMENT header is required", accepts } : null;
}
async function withV1(c, next) {
  const xp = c.req.header("x-payment");
  if (xp && !c.req.header("payment-signature")) {
    let v1; try { v1 = unb64j(xp); } catch { v1 = null; }
    if (v1?.x402Version === 1 && v1.scheme === "exact" && v1.network === "base") {
      // Obtain the exact v2 requirement via an unpaid sub-request through this same app.
      const body = c.req.method === "POST" ? JSON.stringify(c.get("p") ?? {}) : undefined;
      const sub = await app.fetch(new Request(c.req.url, { method: c.req.method, headers: body ? { "content-type": "application/json" } : {}, body }), c.env, c.executionCtx);
      const h = sub.headers.get("payment-required");
      const pr = h && sub.status === 402 ? unb64j(h) : null;
      const accepted = pr?.accepts?.find(a => a.scheme === "exact" && V1_NET[a.network] === "base");
      if (accepted) {
        const headers = new Headers(c.req.raw.headers); headers.delete("x-payment");
        headers.set("payment-signature", b64j({ x402Version: 2, resource: pr.resource, accepted, payload: v1.payload }));
        c.req.raw = new Request(c.req.raw, { headers });
        c.set("v1", true);
      }
    }
  }
  const res = await paywall(c, next);
  const out = res ?? c.res;
  if (out?.status === 402) {
    const h = out.headers.get("payment-required"), b = h && v1Body(h);
    if (b) { const hd = new Headers(out.headers); hd.set("content-type", "application/json"); hd.delete("content-length"); return new Response(JSON.stringify(b), { status: 402, headers: hd }); }
  } else if (out && c.get("v1") && out.headers.get("payment-response")) out.headers.set("x-payment-response", out.headers.get("payment-response"));
  return res;
}


app.onError((e, c) => c.json({ error: "upstream or internal error: " + String((e && e.message) || e).slice(0, 200), retryable: true }, 502));
const H = (path, fn) => app.on(["GET", "POST"], path, async c => { const p = c.get("p"); return respond(c, await fn(chainOf(p) || "base", p)); });
H("/gas", chain => gas(chain));
H("/block", (chain, p) => block(chain, p.number));
H("/balance", (chain, p) => balance(chain, p.address, listOf(p.tokens)));
H("/erc20", (chain, p) => erc20(chain, p.token));
H("/contract", (chain, p) => contract(chain, p.address));
H("/tx-status", (chain, p) => txStatus(chain, p.hash));
H("/resolve", (_, p) => resolve(p.name));
H("/multicall-balances", (chain, p) => multicallBalances(chain, listOf(p.addresses), p.token || null));

const DOCS = {
  name: SERVICE, description: "Cheap EVM read utilities for AI agents on Base and Ethereum mainnet: gas and fees, blocks, balances, ERC-20 metadata, contract inspection, transaction status, ENS/Basename resolution, bulk balances. No API key: pay USDC on Base per call via x402.",
  payment: { protocol: "x402 v2", network: NETWORK, asset: "USDC", payTo: PAY_TO },
  endpoints: Object.keys(ROUTES).filter(k => k.startsWith("POST ")).map(k => { const path = k.split(" ")[1], r = ROUTES[k]; return { method: "POST", path, price: r.accepts.price, what: SUMMARY[path] }; }),
  chains: ["base", "ethereum"],
  howToPay: "Call any endpoint; you get HTTP 402 with payment requirements. Use an x402 client (e.g. @x402/fetch, x402-axios, or an MCP x402 wallet) to sign and retry.",
};
app.get("/", c => /text\/html/i.test(c.req.header("accept") || "") ? c.html(landingHtml(), 200, { "cache-control": "public, max-age=300", vary: "Accept" }) : c.json(DOCS, 200, { vary: "Accept" }));
app.get("/llms.txt", c => c.text(llmsTxt(), 200, { "cache-control": "public, max-age=3600" }));
app.get("/robots.txt", c => c.text(robotsTxt()));
app.get("/d32fa5f5b0aa09cc644601941586b1c1.txt", c => c.text("d32fa5f5b0aa09cc644601941586b1c1"));
app.get("/sitemap.xml", c => c.body(sitemapXml(), 200, { "content-type": "application/xml" }));
app.get("/openapi.json", c => {
  const paths = {};
  for (const [k, r] of Object.entries(ROUTES)) {
    const [method, path] = k.split(" "), m = method.toLowerCase();
    const info = r.extensions.bazaar.info, schema = r.extensions.bazaar.schema.properties.input.properties;
    const inSchema = schema.queryParams || schema.body;
    const op = {
      operationId: path.slice(1).replace(/-(\w)/g, (_, ch) => ch.toUpperCase()) + (m === "post" ? "Post" : "Get"), summary: SUMMARY[path], description: r.description, tags: TAGS[path],
      "x-payment-info": { price: { mode: "fixed", currency: "USD", amount: r.accepts.price.slice(1) }, protocols: [{ x402: {} }] },
      responses: { 200: { description: "Successful response", content: { "application/json": { schema: { type: "object" }, example: info.output.example } } }, 402: { description: "Payment Required" } },
    };
    if (m === "post") op.requestBody = { required: true, content: { "application/json": { schema: inSchema } } };
    else op.parameters = Object.entries(inSchema.properties).map(([name, s]) => ({ name, in: "query", required: (inSchema.required || []).includes(name), schema: s, description: s.description }));
    (paths[path] ??= {})[m] = op;
  }
  return c.json({ openapi: "3.1.0", info: { title: SERVICE, version: "1.0.0", contact: { name: SERVICE, url: "https://github.com/Imac2014Ville/baselens" }, description: DOCS.description,
    "x-guidance": "Pay-per-call USDC on Base via x402, no API key. All tools take chain (base default, or ethereum). POST /gas {chain} ($0.001): gas price, priority fee, and what a transfer/swap costs in USD. POST /block {chain, number?} ($0.001): latest or specific block. POST /balance {chain, address, tokens?[]} ($0.002): ETH + ERC-20 balances. POST /erc20 {chain, token} ($0.002): name, symbol, decimals, supply, owner, proxy. POST /contract {chain, address} ($0.002): contract vs wallet, proxy, EIP-7702, selectors. POST /tx-status {chain, hash} ($0.001): status, confirmations, fee. POST /resolve {name} ($0.002): ENS .eth or Basename .base.eth to address. POST /multicall-balances {chain, addresses[]<=20, token?} ($0.005): bulk balances. GET with query params also works. Malformed input returns 400 and failed lookups return non-2xx, so you are not charged." },
    servers: [{ url: new URL(c.req.url).origin }], paths, "x-discovery": { ownershipProofs: OWNERSHIP_PROOFS } });
});
app.get("/.well-known/x402", c => c.json({ version: 1, resources: [...new Set(Object.keys(ROUTES).map(k => ORIGIN + k.split(" ")[1]))] }));
app.get("/health", c => c.json({ ok: true }));
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0052ff"/><path d="M32 10l19 11v22L32 54 13 43V21z" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="M13 21l19 11 19-11M32 32v22" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>`;
app.get("/favicon.ico", c => c.body(ICON, 200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" }));
app.get("/favicon.svg", c => c.body(ICON, 200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" }));

export default app;
