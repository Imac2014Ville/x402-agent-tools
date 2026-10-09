// MacroLens — pay-per-call global macro statistics and official company registry lookups for AI agents (x402, USDC on Base).
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { landingHtml, llmsTxt, robotsTxt, sitemapXml } from "./landing.js";
import { FailoverFacilitatorClient } from "./facilitator.js";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { INDICATORS, GROUPS, resolveIndicator, isCountry, indicatorSeries, compare, profile, company } from "./data.js";

const PAY_TO = "0x587355795d50262347D8c23D0958C5187352544c";
const NETWORK = "eip155:8453";
const PRICE = "$0.01";
const SERVICE = "MacroLens";

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

const CTRY = { type: "string", description: "ISO2 or ISO3 country code, e.g. US, DE, JPN (aggregates WLD, EUU also work)" };
const INDP = { type: "string", description: "Friendly key (gdp, gdp_per_capita, gdp_growth, inflation, unemployment, population, debt_to_gdp, current_account, interest_rate, exports, imports, fdi, gini, life_expectancy, ...) or a raw World Bank code like NY.GDP.MKTP.CD" };
const ROUTES = {
  "GET /company": route("Use when an agent needs to verify a company or pull official registry data: KYB check, counterparty due diligence, legal status, address, industry and employees from the government register. Norway (NO, Enhetsregisteret) and France (FR, SIRENE/RNE, also officers and revenue). Look up by name (query) or registry number (id).",
    { country: "NO", query: "Equinor" },
    { type: "object", properties: { country: { type: "string", enum: ["NO", "FR"], description: "Registry country: NO (Norway) or FR (France)" }, query: { type: "string", description: "Company name to search (2-100 chars); returns up to limit matches" }, id: { type: "string", description: "Registry number instead of query: NO organisasjonsnummer (9 digits), FR SIREN (9) or SIRET (14)" }, limit: { type: "number", description: "Max matches for a name search, 1-10 (default 5)" } }, required: ["country"] },
    { ok: true, count: 1, companies: [{ country: "NO", registry: "Brønnøysund Register Centre, Enhetsregisteret", id: "923609016", name: "EQUINOR ASA", legalForm: { code: "ASA" }, status: "active", industry: { code: "06.100", description: "Utvinning av råolje" }, employees: 21272, address: "Forusbeen 50, 4035, STAVANGER, Norge" }], source: "Brønnøysund Register Centre (NLOD)" }, "$0.02"),
  "GET /country-profile": route("Use when an agent needs a quick economic snapshot of a country in one call: latest GDP, GDP per capita, GDP growth, inflation, unemployment, population, government debt, current account, exports, imports, FDI, life expectancy and lending rate, with the year of each value. World Bank data for 200+ countries.",
    { country: "JP" }, { type: "object", properties: { country: CTRY }, required: ["country"] },
    { ok: true, country: { iso2: "JP", iso3: "JPN", name: "Japan", region: "East Asia & Pacific", incomeLevel: "High income" }, indicators: { gdp: { value: 4026211000000, year: 2024, units: "USD" }, inflation: { value: 2.7, year: 2024, units: "%" }, unemployment: { value: 2.5, year: 2024, units: "%" } }, source: "World Bank Open Data (CC BY 4.0)" }),
  "GET /compare": route("Use when an agent needs to rank or benchmark countries on one macro indicator: pass up to 10 countries (or G7, BRICS, NORDICS) and an indicator such as unemployment, inflation, gdp_per_capita or debt_to_gdp; returns the latest value of each, ranked, with the year.",
    { countries: "US,DE,JP,GB,FR,IT,CA", indicator: "unemployment" },
    { type: "object", properties: { countries: { type: "string", description: "Comma-separated ISO2/ISO3 codes (max 10) or a group: G7, BRICS, NORDICS, EUROPE_BIG4" }, indicator: INDP, order: { type: "string", enum: ["desc", "asc"], description: "Ranking order (default desc, highest first)" } }, required: ["countries", "indicator"] },
    { ok: true, indicator: { key: "unemployment", units: "%" }, ranking: [{ rank: 1, country: "Italy", iso2: "IT", year: 2024, value: 6.5 }, { rank: 2, country: "France", iso2: "FR", year: 2024, value: 7.4 }], source: "World Bank Open Data (CC BY 4.0)" }),
  "GET /indicator": route("Use when an agent needs a macroeconomic time series for one country: GDP, GDP per capita, GDP growth, inflation, unemployment, population, debt to GDP, current account, exports, imports, FDI, Gini, life expectancy and 20+ more (or any World Bank code), default last 10 years, with units and source.",
    { country: "US", indicator: "gdp", years: 10 },
    { type: "object", properties: { country: CTRY, indicator: INDP, years: { type: "number", description: "Number of most recent years, 1-60 (default 10)" } }, required: ["country", "indicator"] },
    { ok: true, country: { iso2: "US", iso3: "USA", name: "United States" }, indicator: { key: "gdp", code: "NY.GDP.MKTP.CD", name: "GDP (current US$)", units: "USD" }, latest: { year: 2025, value: 30769700000000 }, series: [{ year: 2025, value: 30769700000000 }, { year: 2024, value: 29298013000000 }], source: "World Bank Open Data (CC BY 4.0)" }, "$0.005"),
};
const ORIGIN = "https://macrolens.imac2014ville.workers.dev";
// x402scan/agentcash ownership proofs: EIP-191 signatures of this ORIGIN string by the payTo wallet (overseer fills).
const OWNERSHIP_PROOFS = ["0xd2fb970fde8228c3a194e39eebc9beffb6f58b793f6464d0c26cfbc3343da25c30863f64b6fc345fd81fa95f885552c9c4b93cf46509edfba7840d378ca999c41c"];
const SUMMARY = { "/company": "Official company registry lookup (Norway, France)", "/country-profile": "One-call economic snapshot of a country", "/compare": "Rank countries on a macro indicator", "/indicator": "Macro indicator time series for a country" };
const TAGS = { "/company": ["company-registry", "kyb", "due-diligence", "norway", "france"], "/country-profile": ["macro", "economy", "country-data", "gdp", "world-bank"], "/compare": ["macro", "ranking", "country-comparison", "world-bank", "economy"], "/indicator": ["macro", "gdp", "inflation", "unemployment", "world-bank"] };
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
const scalar = v => v === undefined || v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
const intIn = (v, lo, hi) => v === undefined || v === "" || (Number.isInteger(Number(v)) && Number(v) >= lo && Number(v) <= hi);
export const parseCountries = v => (Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[,;\s]+/)).map(x => x.trim()).filter(Boolean).flatMap(x => GROUPS[x.toUpperCase()] ? GROUPS[x.toUpperCase()].split(";") : [x]);
// Returns an error string for invalid input, else null. Runs BEFORE the paywall so buyers are never charged for a 400.
function validate(path, p) {
  if (!Object.values(p).every(v => scalar(v) || (path === "/compare" && Array.isArray(v)))) return "parameters must be scalars";
  const indOk = () => (resolveIndicator(p.indicator) ? null : "unknown indicator: use a key like gdp, inflation, unemployment, debt_to_gdp or a World Bank code");
  switch (path) {
    case "/indicator":
      if (!isCountry(p.country)) return "pass country=ISO2 or ISO3 code (e.g. US, DEU)";
      if (!intIn(p.years, 1, 60)) return "years must be an integer 1-60";
      return indOk();
    case "/country-profile": return isCountry(p.country) ? null : "pass country=ISO2 or ISO3 code (e.g. JP, DEU)";
    case "/compare": {
      const cs = parseCountries(p.countries);
      if (cs.length < 2 || cs.length > 10) return "pass countries= 2 to 10 ISO codes (comma-separated) or a group: G7, BRICS, NORDICS, EUROPE_BIG4";
      if (!cs.every(isCountry)) return "countries must be ISO2/ISO3 codes";
      if (p.order && !["asc", "desc"].includes(String(p.order).toLowerCase())) return "order must be asc or desc";
      return indOk();
    }
    case "/company": {
      const cc = String(p.country || "").toUpperCase();
      if (!["NO", "FR"].includes(cc)) return "country must be NO or FR";
      const id = p.id === undefined || p.id === "" ? null : String(p.id).replace(/[\s.]/g, "");
      if (id) { if (!(cc === "NO" ? /^\d{9}$/.test(id) : /^(\d{9}|\d{14})$/.test(id))) return cc === "NO" ? "id must be a 9-digit organisasjonsnummer" : "id must be a 9-digit SIREN or 14-digit SIRET"; }
      else if (typeof p.query !== "string" || p.query.trim().length < 2 || p.query.length > 100) return "pass query=company name (2-100 chars) or id=registry number";
      return intIn(p.limit, 1, 10) ? null : "limit must be an integer 1-10";
    }
  }
  return null;
}
// Failed lookups return non-2xx so the x402 middleware cancels settlement (buyer is not charged).
function failStatus(r) {
  if (r.found === false) return 404;
  if (r.ok !== false) return 200;
  return /timeout|timed out|aborted/i.test(String(r.error || "")) ? 504 : 502;
}
// Zero-parameter requests (sweeper buyers) get a default example instead of a 400.
const withD = (c, r) => (c.get("dflt") && r && typeof r === "object" ? { ...r, defaultsUsed: c.get("dflt") } : r);
const respond = (c, r) => c.json(withD(c, r), failStatus(r));
const DEFAULTS = { "/indicator": { country: "US", indicator: "gdp" }, "/country-profile": { country: "US" }, "/compare": { countries: "G7", indicator: "gdp_growth" }, "/company": { country: "NO", query: "Equinor" } };

app.use(async (c, next) => {
  const path = c.req.path;
  if ((c.req.method === "GET" || c.req.method === "POST") && ROUTES[`${c.req.method} ${path}`]) {
    let p = await params(c);
    // No params at all (paid or not): skip validation, use DEFAULTS so the paywall settles and the buyer gets a useful example.
    // Params present but malformed still 400 here, BEFORE the paywall, so nobody pays for a bad request.
    if (!Object.keys(p).length && DEFAULTS[path]) {
      p = { ...DEFAULTS[path] };
      c.set("dflt", { ...DEFAULTS[path], note: `No parameters supplied; returning a default example. Pass ${Object.keys(DEFAULTS[path]).join(" / ")} to query your own.` });
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
app.on(["GET", "POST"], "/indicator", async c => { const p = c.get("p"); return respond(c, await indicatorSeries(String(p.country).trim().toUpperCase(), resolveIndicator(p.indicator), num(p.years, 10))); });
app.on(["GET", "POST"], "/country-profile", async c => respond(c, await profile(String(c.get("p").country).trim().toUpperCase())));
app.on(["GET", "POST"], "/compare", async c => { const p = c.get("p"); return respond(c, await compare(parseCountries(p.countries).map(x => x.toUpperCase()), resolveIndicator(p.indicator), String(p.order || "desc").toLowerCase())); });
app.on(["GET", "POST"], "/company", async c => { const p = c.get("p"); const id = p.id === undefined || p.id === "" ? null : String(p.id).replace(/[\s.]/g, "");
  return respond(c, await company(String(p.country).toUpperCase(), id, id ? null : String(p.query).trim(), num(p.limit, 5))); });

const DOCS = {
  name: SERVICE, description: "Global macro statistics (GDP, inflation, unemployment, debt and 30+ indicators for 200+ countries), country profiles and rankings, and official company registry lookups (Norway, France) for AI agents. No API key: pay USDC on Base per call via x402.",
  payment: { protocol: "x402 v2", network: NETWORK, asset: "USDC", payTo: PAY_TO },
  endpoints: [
    { method: "POST", path: "/company {country: NO|FR, query | id}", price: "$0.02", what: "Official company registry lookup" },
    { method: "POST", path: "/country-profile {country}", price: "$0.01", what: "Latest key indicators for a country in one call" },
    { method: "POST", path: "/compare {countries, indicator}", price: "$0.01", what: "Rank up to 10 countries on one indicator" },
    { method: "POST", path: "/indicator {country, indicator, years}", price: "$0.005", what: "Macro indicator time series" },
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
    "x-guidance": "Pay-per-call USDC on Base via x402. POST /company {country: NO|FR, query or id} ($0.02): official registry data for a company (status, legal form, address, industry, employees; France adds officers and revenue). POST /country-profile {country} ($0.01): latest GDP, growth, inflation, unemployment, population, debt, current account, trade, FDI, life expectancy in one call. POST /compare {countries (<=10 or G7), indicator} ($0.01): ranked latest values. POST /indicator {country, indicator, years} ($0.005): time series; indicators: gdp, gdp_per_capita, gdp_growth, inflation, unemployment, population, debt_to_gdp, current_account, interest_rate, exports, imports, fdi, gini, life_expectancy or a World Bank code. GET with query params also works. Malformed input returns 400 and unknown countries or failed lookups return non-2xx, so you are not charged." },
    servers: [{ url: new URL(c.req.url).origin }], paths, "x-discovery": { ownershipProofs: OWNERSHIP_PROOFS } });
});
app.get("/.well-known/x402", c => c.json({ version: 1, resources: [...new Set(Object.keys(ROUTES).map(k => ORIGIN + k.split(" ")[1]))] }));
app.get("/health", c => c.json({ ok: true }));
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b7a5a"/><circle cx="30" cy="30" r="14" fill="none" stroke="#fff" stroke-width="5"/><path d="M40 40l12 12" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M22 34l5-5 4 3 6-7" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
app.get("/favicon.ico", c => c.body(ICON, 200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" }));
app.get("/favicon.svg", c => c.body(ICON, 200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" }));

export default app;
