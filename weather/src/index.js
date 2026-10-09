// SkyFeed — pay-per-call weather forecasts, severe-weather alerts, earthquakes and public holidays for AI agents (x402, USDC on Base).
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { landingHtml, llmsTxt, robotsTxt, sitemapXml } from "./landing.js";
import { FailoverFacilitatorClient } from "./facilitator.js";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { findCity, locate, validLat, validLon, US_STATES, forecast, current, alerts, quakes, holidays, travelCheck } from "./data.js";

const PAY_TO = "0x7ab8a8d4DD4a37FAaEB4d0EEaDc53B74eb00C283";
const NETWORK = "eip155:8453";
const PRICE = "$0.005";
const SERVICE = "SkyFeed";

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

const LAT = { type: "number", description: "Latitude in decimal degrees, -90 to 90 (use with lon)" };
const LON = { type: "number", description: "Longitude in decimal degrees, -180 to 180 (use with lat)" };
const CITY = { type: "string", description: "Major world city name, e.g. Tokyo, London, New York (about 260 built in; otherwise pass lat and lon)" };
const LOC_REQ = { anyOf: [{ required: ["lat", "lon"] }, { required: ["city"] }] };
const sampleHour = { time: "2026-10-09T16:00:00Z", tempC: 20.6, windMs: 3.4, windKmh: 12.2, windFromDeg: 262.7, humidityPct: 41.2, cloudPct: 0, pressureHpa: 1020.6, precipMm: 0, symbol: "clearsky_day", stepHours: 1 };
const ROUTES = {
  "GET /forecast": route("Use when an agent needs an hourly weather forecast for a place: temperature, wind, precipitation, humidity, cloud cover and a weather symbol for each of the next 1-48 hours, plus a one-line summary. Global coverage. Pass city (major world cities) or lat and lon.",
    { city: "New York", hours: 24 },
    { type: "object", properties: { city: CITY, lat: LAT, lon: LON, hours: { type: "number", description: "Hours ahead, 1-48 (default 24)" } }, ...LOC_REQ },
    { ok: true, location: { city: "New York", country: "US", lat: 40.713, lon: -74.006 }, hours: 24, summary: { minTempC: 14.2, maxTempC: 21.1, maxWindMs: 6.1, totalPrecipMm: 0.4, wetHours: 1, text: "14.2 to 21.1 C, 0.4 mm precipitation, peak wind 6.1 m/s over the next 24 h" }, forecast: [sampleHour], source: "MET Norway Locationforecast (CC BY 4.0)" }),
  "GET /current": route("Use when an agent needs the weather right now at a place: temperature, wind, humidity, cloud cover, pressure, precipitation and sky condition for the current hour. Global coverage. Pass city or lat and lon.",
    { city: "London" }, { type: "object", properties: { city: CITY, lat: LAT, lon: LON }, ...LOC_REQ },
    { ok: true, location: { city: "London", country: "GB", lat: 51.507, lon: -0.128 }, ...sampleHour, source: "MET Norway Locationforecast (CC BY 4.0)" }, "$0.003"),
  "GET /alerts": route("Use when an agent needs active severe-weather warnings in the United States: tornado, flood, storm, heat, winter and fire alerts from the National Weather Service with severity, area, timing and instructions. Query by US state (2-letter code) or by lat and lon.",
    { state: "CA" }, { type: "object", properties: { state: { type: "string", description: "US state or territory 2-letter code, e.g. CA, TX, FL, PR" }, lat: LAT, lon: LON }, anyOf: [{ required: ["state"] }, { required: ["lat", "lon"] }] },
    { ok: true, query: { state: "CA" }, count: 1, alerts: [{ event: "Red Flag Warning", severity: "Severe", urgency: "Expected", headline: "Red Flag Warning issued October 9 ...", area: "Santa Barbara County Mountains", onset: "2026-10-09T08:00:00-07:00", ends: "2026-10-10T20:00:00-07:00", sender: "NWS Los Angeles CA" }], source: "US National Weather Service (public domain)" }),
  "GET /earthquakes": route("Use when an agent needs recent earthquake activity: events from the USGS feed filtered by minimum magnitude and time window (up to 168 hours), optionally limited to a radius around a point. Returns time, magnitude, place, depth, coordinates, tsunami flag and distance.",
    { minMagnitude: 4.5, hours: 24 }, { type: "object", properties: { minMagnitude: { type: "number", description: "Minimum magnitude 0-10 (default 4.5)" }, hours: { type: "number", description: "Look-back window in hours, 1-168 (default 24)" }, lat: LAT, lon: LON, radiusKm: { type: "number", description: "Radius around lat/lon in km, 1-20000 (default 500); requires lat and lon" } } },
    { ok: true, query: { minMagnitude: 4.5, hours: 24 }, count: 1, earthquakes: [{ time: "2026-10-09T10:38:55.617Z", magnitude: 4.6, place: "south of the Fiji Islands", lat: -24.1, lon: 179.9, depthKm: 520, tsunami: false, url: "https://earthquake.usgs.gov/earthquakes/eventpage/us6000u168" }], source: "USGS Earthquake Hazards Program (public domain)" }, "$0.003"),
  "GET /holidays": route("Use when an agent needs the public holidays of a country: date, English and local name, whether nationwide, regions and type for a given year. Covers 100+ countries; pass an ISO 2-letter country code.",
    { country: "US", year: 2026 }, { type: "object", properties: { country: { type: "string", description: "ISO 3166-1 alpha-2 code, e.g. US, DE, JP" }, year: { type: "number", description: "Year 1990-2100 (default current year)" } }, required: ["country"] },
    { ok: true, country: "US", year: 2026, count: 1, holidays: [{ date: "2026-01-01", name: "New Year's Day", localName: "New Year's Day", nationwide: true, regions: null, types: ["Public", "Bank"] }], source: "Nager.Date (open-source, MIT)" }, "$0.002"),
  "GET /travel-check": route("Use when an agent is planning a trip or event in a city and needs one bundled answer: that day's weather (temperature range, rain, wind, hourly), public holidays within 3 days, recent earthquakes within 300 km, and risk flags. Date within the next ~9 days (default today).",
    { city: "Tokyo", date: "2026-10-12" }, { type: "object", properties: { city: { type: "string", description: "Major world city name, e.g. Tokyo (built-in table of ~260 cities)" }, date: { type: "string", description: "YYYY-MM-DD within about 9 days ahead (default today, UTC)" } }, required: ["city"] },
    { ok: true, location: { city: "Tokyo", country: "JP", lat: 35.677, lon: 139.65 }, date: "2026-10-12", weather: { date: "2026-10-12", minTempC: 17.8, maxTempC: 24.5, totalPrecipMm: 0, maxWindMs: 5.2, mainSymbol: "partlycloudy_day", hourly: [sampleHour] }, holidays: { country: "JP", withinThreeDays: [{ date: "2026-10-12", name: "Sports Day" }] }, nearbyQuakes: { radiusKm: 300, minMagnitude: 2.5, pastDays: 7, count: 3, strongest: [] }, riskFlags: ["public holiday nearby (closures, crowds, price spikes)"], source: "MET Norway (CC BY 4.0), Nager.Date, USGS (public domain)" }, "$0.01"),
};
const ORIGIN = "https://skyfeed.imac2014ville.workers.dev";
// x402scan/agentcash ownership proofs: EIP-191 signatures of this ORIGIN string by the payTo wallet (overseer fills).
const OWNERSHIP_PROOFS = ["0xa33af0b03d91b73ab6c7f8926673470297d4215061ae4adca4767ea4675caa8505a70e92c0a95d37592e2f922285aa5f97f9ee726f7a9d93333715c4d6e3dcad1b"];
const SUMMARY = { "/forecast": "Hourly weather forecast, up to 48 hours", "/current": "Current weather at a place", "/alerts": "Active US National Weather Service alerts", "/earthquakes": "Recent earthquakes from USGS", "/holidays": "Public holidays by country and year", "/travel-check": "Weather + holidays + nearby quakes for a trip day" };
const TAGS = { "/forecast": ["weather", "forecast", "hourly", "temperature", "precipitation"], "/current": ["weather", "current-conditions", "temperature", "wind"], "/alerts": ["weather-alerts", "nws", "severe-weather", "hazards", "usa"], "/earthquakes": ["earthquakes", "usgs", "seismic", "hazards"], "/holidays": ["holidays", "public-holidays", "calendar", "travel"], "/travel-check": ["travel", "weather", "holidays", "risk", "trip-planning"] };
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

const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !isNaN(Date.parse(v + "T00:00:00Z")) && new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === String(v);
const numIn = (v, lo, hi) => v === undefined || v === "" || (isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi);
// Returns an error string for invalid input, else null. Runs BEFORE the paywall so buyers are never charged for a 400.
function validate(path, p) {
  if (!Object.values(p).every(scalar)) return "parameters must be scalars";
  const has = k => p[k] !== undefined && p[k] !== "";
  const locErr = () => {
    if (has("lat") || has("lon")) return has("lat") && has("lon") && validLat(p.lat) && validLon(p.lon) ? null : "lat must be -90..90 and lon -180..180 (pass both)";
    if (!has("city")) return "pass city (e.g. Tokyo) or lat and lon";
    return findCity(p.city) ? null : "unknown city: only ~260 major world cities are built in; pass lat and lon instead";
  };
  switch (path) {
    case "/forecast": return locErr() || (intIn(p.hours, 1, 48) ? null : "hours must be an integer 1-48");
    case "/current": return locErr();
    case "/alerts":
      if (has("state")) return US_STATES.includes(String(p.state).trim().toUpperCase()) ? null : "state must be a US 2-letter code (e.g. CA, TX, PR)";
      return has("lat") && has("lon") && validLat(p.lat) && validLon(p.lon) ? null : "pass state=US 2-letter code, or lat and lon";
    case "/earthquakes":
      if (!numIn(p.minMagnitude, 0, 10)) return "minMagnitude must be 0-10";
      if (!intIn(p.hours, 1, 168)) return "hours must be an integer 1-168";
      if (has("lat") || has("lon")) { if (!(has("lat") && has("lon") && validLat(p.lat) && validLon(p.lon))) return "lat must be -90..90 and lon -180..180 (pass both)"; }
      else if (has("radiusKm")) return "radiusKm requires lat and lon";
      return numIn(p.radiusKm, 1, 20000) ? null : "radiusKm must be 1-20000";
    case "/holidays":
      if (!/^[A-Za-z]{2}$/.test(String(p.country || "").trim())) return "pass country=ISO 3166-1 alpha-2 code (e.g. US, DE)";
      return intIn(p.year, 1990, 2100) ? null : "year must be an integer 1990-2100";
    case "/travel-check":
      if (!findCity(p.city)) return "pass city=a major world city (e.g. Tokyo); ~260 are built in";
      return !has("date") || isDate(p.date) ? null : "date must be YYYY-MM-DD";
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
const DEFAULTS = { "/forecast": { city: "New York" }, "/current": { city: "New York" }, "/alerts": { state: "NY" }, "/earthquakes": { minMagnitude: 4.5, hours: 24 }, "/holidays": { country: "US" }, "/travel-check": { city: "New York" } };

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
const todayUtc = () => new Date().toISOString().slice(0, 10);
app.on(["GET", "POST"], "/forecast", async c => { const p = c.get("p"); return respond(c, await forecast(locate(p), num(p.hours, 24))); });
app.on(["GET", "POST"], "/current", async c => respond(c, await current(locate(c.get("p")))));
app.on(["GET", "POST"], "/alerts", async c => { const p = c.get("p"); return respond(c, await alerts(p.state ? { state: String(p.state).trim() } : p)); });
app.on(["GET", "POST"], "/earthquakes", async c => { const p = c.get("p"); const near = p.lat !== undefined && p.lat !== "";
  return respond(c, await quakes({ minMagnitude: num(p.minMagnitude, 4.5), hours: num(p.hours, 24), ...(near ? { lat: Number(p.lat), lon: Number(p.lon), radiusKm: num(p.radiusKm, 500) } : {}) })); });
app.on(["GET", "POST"], "/holidays", async c => { const p = c.get("p"); return respond(c, await holidays(String(p.country).trim().toUpperCase(), num(p.year, new Date().getUTCFullYear()))); });
app.on(["GET", "POST"], "/travel-check", async c => { const p = c.get("p"); return respond(c, await travelCheck(String(p.city), p.date ? String(p.date) : todayUtc())); });

const DOCS = {
  name: SERVICE, description: "Pay-per-call weather forecasts (global), current conditions, US severe-weather alerts, earthquakes, public holidays and a bundled travel check for AI agents. No API key: pay USDC on Base per call via x402.",
  payment: { protocol: "x402 v2", network: NETWORK, asset: "USDC", payTo: PAY_TO },
  endpoints: [
    { method: "POST", path: "/forecast {city | lat, lon, hours?}", price: "$0.005", what: "Hourly forecast, up to 48 h" },
    { method: "POST", path: "/current {city | lat, lon}", price: "$0.003", what: "Current conditions" },
    { method: "POST", path: "/alerts {state | lat, lon}", price: "$0.005", what: "Active US NWS alerts" },
    { method: "POST", path: "/earthquakes {minMagnitude?, hours?, lat?, lon?, radiusKm?}", price: "$0.003", what: "Recent USGS earthquakes" },
    { method: "POST", path: "/holidays {country, year?}", price: "$0.002", what: "Public holidays" },
    { method: "POST", path: "/travel-check {city, date?}", price: "$0.01", what: "Weather + holidays + nearby quakes bundle" },
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
    "x-guidance": "Pay-per-call USDC on Base via x402. POST /forecast {city or lat+lon, hours<=48} ($0.005): hourly temperature, wind, precipitation, symbol and a summary, global. POST /current {city or lat+lon} ($0.003): conditions now. POST /alerts {state (US 2-letter) or lat+lon} ($0.005): active NWS alerts, US only. POST /earthquakes {minMagnitude, hours<=168, lat, lon, radiusKm} ($0.003): USGS events. POST /holidays {country ISO2, year} ($0.002): public holidays. POST /travel-check {city, date within ~9 days} ($0.01): weather + holidays + nearby quakes + risk flags. City must be one of ~260 built-in major cities, otherwise pass lat and lon. GET with query params also works. Malformed input returns 400 and failed lookups return non-2xx, so you are not charged." },
    servers: [{ url: new URL(c.req.url).origin }], paths, "x-discovery": { ownershipProofs: OWNERSHIP_PROOFS } });
});
app.get("/.well-known/x402", c => c.json({ version: 1, resources: [...new Set(Object.keys(ROUTES).map(k => ORIGIN + k.split(" ")[1]))] }));
app.get("/health", c => c.json({ ok: true }));
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1565c0"/><circle cx="24" cy="24" r="8" fill="#ffd54f"/><path d="M20 46a9 9 0 0 1 1-18 12 12 0 0 1 23 3 8 8 0 0 1-1 15z" fill="#fff"/></svg>`;
app.get("/favicon.ico", c => c.body(ICON, 200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" }));
app.get("/favicon.svg", c => c.body(ICON, 200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" }));

export default app;
