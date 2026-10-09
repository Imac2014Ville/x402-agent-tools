// TokenGuard Base — pay-per-call Base token-safety tools for AI agents and bots (x402, USDC on Base).
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { landingHtml, llmsTxt, robotsTxt, sitemapXml } from "./landing.js";
import { FailoverFacilitatorClient } from "./facilitator.js";
import { newPools } from "./pools.js";
import { tokenRisk } from "./risk.js";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";

const PAY_TO = "0xe296A4dfee08FF48938df20300D4B7CF957B1F04";
const NETWORK = "eip155:8453";
const PRICE = "$0.01";
const SERVICE = "TokenGuard Base";
const isAddr = a => /^0x[0-9a-fA-F]{40}$/.test(a || "");

// Annotate each new pool with tokenRisk() verdicts. Bounded: <=10 tokens, concurrency 3, ~20s budget.
async function launchScan({ minutes, quote, limit }) {
  const t0 = Date.now(), BUDGET = 20000, CONC = 3;
  const base = await newPools({ minutes, quote, minLiquidityUsd: 0, limit });
  const pools = (base.pools || []).slice(0, 10);
  const addrs = [...new Set(pools.map(p => p.token?.address).filter(Boolean))];
  const results = new Map();
  let next = 0;
  async function worker() {
    while (next < addrs.length) {
      const a = addrs[next++];
      const left = BUDGET - (Date.now() - t0);
      if (left < 1500) { results.set(a, { error: "time budget exhausted" }); continue; }
      try {
        const r = await Promise.race([tokenRisk(a), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), left))]);
        results.set(a, r && r.ok !== false ? r : { error: String(r?.error || "screen failed") });
      } catch (e) { results.set(a, { error: String(e.message || e).slice(0, 100) }); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, addrs.length) }, worker));
  const out = pools.map(p => {
    const r = results.get(p.token?.address);
    if (!r || r.error) return { ...p, screened: false, verdict: null, riskScore: null, screenNote: r?.error || "not screened" };
    return { ...p, screened: true, verdict: r.verdict, riskScore: r.riskScore, riskFlags: r.flags, sellSimulation: r.sellSimulation, ownershipRenounced: r.ownershipRenounced, tokenLiquidityUsd: r.liquidityUsd };
  });
  const safe = out.filter(p => p.verdict === "LOW_RISK" || p.verdict === "CAUTION").length;
  return { ok: true, chain: "base", minutes, count: out.length, screenedCount: out.filter(p => p.screened).length, passedCount: safe,
    elapsedMs: Date.now() - t0, pools: out, note: "Verdict per token: LOW_RISK/CAUTION/HIGH_RISK/AVOID. Automated heuristics, not financial advice; brand-new tokens are inherently risky." };
}

// ---------- app ----------
const app = new Hono();
const server = new x402ResourceServer(new FailoverFacilitatorClient())
  .register(NETWORK, new ExactEvmScheme());
server.registerExtension(bazaarResourceServerExtension);

const route = (description, input, inputSchema, example, price = PRICE) => ({
  accepts: { scheme: "exact", price, network: NETWORK, payTo: PAY_TO },
  description, mimeType: "application/json",
  extensions: declareDiscoveryExtension({ input, inputSchema, output: { example } }),
});

const POOL_PROPS = { minutes: { type: "number", description: "Look-back window, 1-120 (default 30)" }, quote: { type: "string", enum: ["any", "weth", "usdc"], description: "Quote token filter (default any; launch-scan default weth)" } };
const ROUTES = {
  "GET /launch-scan": route("New token launches pre-screened for honeypots on Base: sniper safety in one call. Lists the newest pools (Uniswap v2/v3/v4, Aerodrome) and runs a honeypot check and rug pull check on each token; every pool comes back with verdict (LOW_RISK/CAUTION/HIGH_RISK/AVOID), risk score and flags. Max 10 tokens per call.",
    { minutes: 30, quote: "weth", limit: 5 },
    { type: "object", properties: { ...POOL_PROPS, limit: { type: "number", description: "Max pools to screen, 1-10 (default 5)" } } },
    { ok: true, count: 5, screenedCount: 5, pools: [{ dex: "uniswap-v4", token: { symbol: "XYZ" }, ageMinutes: 3, liquidityUsd: 12000, screened: true, verdict: "AVOID", riskScore: 75, riskFlags: [{ severity: "critical", issue: "Simulated transfer into the main pool REVERTS: likely honeypot / sells blocked" }] }] }, "$0.03"),
  "GET /token-risk": route("Honeypot check and rug pull check for any Base token: is this token safe to buy? Scam token detector: simulates a sell, checks owner powers (mint, blacklist, pause, fees, proxy), renounced ownership, liquidity, LP burn. Returns LOW_RISK/CAUTION/HIGH_RISK/AVOID, risk score 0-100.",
    { token: "0x940181a94A35A4569E4529A3CDfB74e38FD98631" },
    { type: "object", properties: { token: { type: "string", description: "ERC-20 contract address on Base" } }, required: ["token"] },
    { ok: true, symbol: "AERO", verdict: "LOW_RISK", riskScore: 0, flags: [], liquidityUsd: 48832868, priceUsd: 0.8378, sellSimulation: { simulated: true, sellToPoolSucceeds: true } }, "$0.02"),
  "GET /new-pools": route("New token launches on Base in the last N minutes (Uniswap v2/v3/v4, Aerodrome): token, quote, initial price, liquidity, hooks, flags. Sniper feed; use /launch-scan for launches pre-screened for honeypots, or /token-risk on each token before buying.",
    { minutes: 30, quote: "weth", limit: 25 },
    { type: "object", properties: { ...POOL_PROPS, minLiquidityUsd: { type: "number", description: "Minimum USD liquidity (excludes v4 pools, whose liquidity is not measured)" }, limit: { type: "number", description: "Max pools, 1-100 (default 25)" } } },
    { ok: true, count: 25, pools: [{ dex: "uniswap-v4", token: { symbol: "XYZ" }, quote: "WETH", ageMinutes: 3, priceUsd: 0.00012, flags: ["custom-hooks"] }] }),
};
const ORIGIN = "https://tokenguard.imac2014ville.workers.dev";
// x402scan/agentcash ownership proofs: EIP-191 signatures of this ORIGIN string by the payTo wallet (overseer fills).
const OWNERSHIP_PROOFS = ["0x95b0c6525e891bd434f731e84c3ba6adfec215373ebf68c8cbc9ce5915f31ca8292015b6cb4217b21a0e7d7923e5128be6b282e866c6053045af7d4881c6069f1b"];
const SUMMARY = { "/launch-scan": "New token launches on Base pre-screened for honeypots", "/token-risk": "Honeypot check / rug pull check: is this Base token safe?", "/new-pools": "New token launches on Base (sniper feed)" };
const TAGS = { "/launch-scan": ["new-tokens", "honeypot", "sniper-safety", "token-safety", "base"], "/token-risk": ["honeypot", "rug-check", "token-safety", "scam-token", "base"], "/new-pools": ["new-tokens", "sniper", "dex", "base", "trading"] };
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
// Returns an error string for invalid input, else null. Runs BEFORE the paywall so buyers are never charged for a 400.
function validate(path, p) {
  const str = v => v === undefined || v === null || v === "" || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
  const quoteOk = () => p.quote !== undefined && p.quote !== "" && !["any", "weth", "usdc"].includes(String(p.quote).toLowerCase()) ? "quote must be any, weth or usdc" : null;
  switch (path) {
    case "/token-risk": return isAddr(p.token) ? null : "pass token=0x…(40 hex)";
    case "/new-pools":
      if (![p.minutes, p.quote, p.minLiquidityUsd, p.limit].every(str)) return "parameters must be scalars";
      return quoteOk();
    case "/launch-scan":
      if (![p.minutes, p.quote, p.limit].every(str)) return "parameters must be scalars";
      return quoteOk();
  }
  return null;
}
// Failed lookups return non-2xx so the x402 middleware cancels settlement (buyer is not charged).
function failStatus(r) {
  if (r.found === false) return 404;
  if (r.ok !== false) return 200;
  const e = String(r.error || "");
  if (/no contract at this address/.test(e)) return 404;
  if (/not an ERC-20/.test(e)) return 422;
  if (/timeout|timed out|aborted/i.test(e)) return 504;
  return 502;
}
// Zero-parameter requests (sweeper buyers) get a default example instead of a 400; see DEFAULTS.
const withD = (c, r) => (c.get("dflt") && r && typeof r === "object" ? { ...r, defaultsUsed: c.get("dflt") } : r);
const respond = (c, r) => c.json(withD(c, r), failStatus(r));
const dnote = k => `No parameters supplied; returning a default example. Pass ${k} to query your own.`;
const DEFAULTS = { "/token-risk": { token: "0x940181a94A35A4569E4529A3CDfB74e38FD98631" }, "/new-pools": {}, "/launch-scan": {} };

app.use(async (c, next) => {
  const path = c.req.path;
  if ((c.req.method === "GET" || c.req.method === "POST") && ROUTES[`${c.req.method} ${path}`]) {
    let p = await params(c);
    // No params at all (paid or not): skip validation, use DEFAULTS so the paywall settles and the buyer gets a useful example.
    // Params present but malformed still 400 here, BEFORE the paywall, so nobody pays for a bad request.
    if (!Object.keys(p).length && DEFAULTS[path]) {
      p = { ...DEFAULTS[path] };
      c.set("dflt", { ...DEFAULTS[path], note: dnote(Object.keys(DEFAULTS[path]).join(" / ") || "parameters") });
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
const num = (v, d) => (v === undefined || v === "" || isNaN(Number(v)) ? d : Number(v));
app.on(["GET", "POST"], "/new-pools", async c => { const p = c.get("p");
  return c.json(withD(c, await newPools({ minutes: Math.min(Math.max(num(p.minutes, 30), 1), 120), quote: String(p.quote || "any").toLowerCase(), minLiquidityUsd: num(p.minLiquidityUsd, 0), limit: Math.min(Math.max(num(p.limit, 25), 1), 100) }))); });
app.on(["GET", "POST"], "/token-risk", async c => respond(c, await tokenRisk(c.get("p").token)));
app.on(["GET", "POST"], "/launch-scan", async c => { const p = c.get("p");
  return respond(c, await launchScan({ minutes: Math.min(Math.max(num(p.minutes, 30), 1), 120), quote: String(p.quote || "weth").toLowerCase(), limit: Math.min(Math.max(Math.floor(num(p.limit, 5)), 1), 10) })); });

const DOCS = {
  name: SERVICE, description: "Honeypot check, rug pull check and scam token detector for Base tokens (is this token safe?), plus new token launches pre-screened for honeypots (sniper safety). No API key: pay USDC on Base per call via x402.",
  payment: { protocol: "x402 v2", network: NETWORK, asset: "USDC", payTo: PAY_TO },
  endpoints: [
    { method: "POST", path: "/launch-scan {minutes, quote, limit}", price: "$0.03", what: "New Base launches pre-screened for honeypots (verdict + risk score per pool)" },
    { method: "POST", path: "/token-risk {token}", price: "$0.02", what: "Base token honeypot / rug pull check" },
    { method: "POST", path: "/new-pools {minutes, quote}", price: "$0.01", what: "New Base pools (Uni v2/v3/v4, Aerodrome)" },
  ],
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
    "x-guidance": "Pay-per-call USDC on Base via x402. POST /token-risk {token} ($0.02): honeypot check / rug pull check - is this Base token safe? Simulated sell, owner powers, liquidity, LP burn, verdict LOW_RISK/CAUTION/HIGH_RISK/AVOID and risk score 0-100. POST /launch-scan {minutes, quote, limit<=10} ($0.03): new token launches pre-screened for honeypots, each pool annotated with verdict, riskScore and flags (sniper safety; takes up to ~20s). POST /new-pools {minutes, quote} ($0.01): raw feed of new Base pools. GET with query params also works. Malformed input returns 400 and failed lookups return non-2xx, so you are not charged." },
    servers: [{ url: new URL(c.req.url).origin }], paths, "x-discovery": { ownershipProofs: OWNERSHIP_PROOFS } });
});
app.get("/.well-known/x402", c => c.json({ version: 1, resources: [...new Set(Object.keys(ROUTES).map(k => ORIGIN + k.split(" ")[1]))] }));
app.get("/health", c => c.json({ ok: true }));
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0052ff"/><path d="M32 10l18 7v13c0 11-8 20-18 24C22 50 14 41 14 30V17z" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="M24 31l6 6 11-12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
app.get("/favicon.ico", c => c.body(ICON, 200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" }));
app.get("/favicon.svg", c => c.body(ICON, 200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" }));

export default app;
