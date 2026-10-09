// Upstream data access for SkyFeed. All sources are keyless and allow commercial reuse (see landing page attributions).
import { findCity, CITIES } from "./cities.js";
export { findCity, CITIES };

export const UA = "SkyFeed/1.0 (+https://skyfeed.imac2014ville.workers.dev)";
export const US_STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR GU VI AS MP".split(" ");

// ---- cache + fetch ----
const cache = new Map();
const retry1 = async fn => { try { return await fn(); } catch { return await fn(); } };
async function getJson1(url, ttl) {
  const hit = cache.get(url);
  if (hit && hit.exp > Date.now()) return hit.v;
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 9000);
  let r;
  try { r = await fetch(url, { signal: ac.signal, headers: { accept: "application/json", "user-agent": UA } }); }
  catch (e) { throw new Error(ac.signal.aborted ? "upstream timeout" : "upstream unreachable"); }
  finally { clearTimeout(t); }
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = null; }
  const v = { status: r.status, body };
  if (r.status < 500 && r.status !== 429) {
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    cache.set(url, { v, exp: Date.now() + ttl });
  }
  return v;
}
const getJson = (url, ttl = 900_000) => retry1(() => getJson1(url, ttl));
const fail = (error, extra) => ({ ok: false, error, ...extra });
const r1 = x => (x === null || x === undefined ? null : Math.round(x * 10) / 10);

// ---- location ----
export const validLat = v => v !== "" && v !== null && v !== undefined && isFinite(Number(v)) && Math.abs(Number(v)) <= 90;
export const validLon = v => v !== "" && v !== null && v !== undefined && isFinite(Number(v)) && Math.abs(Number(v)) <= 180;
export function locate(p) {
  if (p.lat !== undefined && p.lat !== "" && p.lon !== undefined && p.lon !== "") return { lat: Number(p.lat), lon: Number(p.lon), name: null, country: null };
  const c = findCity(p.city);
  return c ? { lat: c.lat, lon: c.lon, name: c.name, country: c.country } : null;
}

// ---- MET Norway locationforecast ----
async function metSeries(lat, lon) {
  const la = lat.toFixed(3), lo = lon.toFixed(3);
  const r = await getJson(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${la}&lon=${lo}`, 1_200_000);
  if (r.status !== 200 || !r.body?.properties?.timeseries) return { err: `MET Norway returned HTTP ${r.status}` };
  return { ts: r.body.properties.timeseries, updated: r.body.properties.meta?.updated_at, elevation: r.body.geometry?.coordinates?.[2] };
}
const slot = e => {
  const d = e.data, i = d.instant.details, n = d.next_1_hours || d.next_6_hours || d.next_12_hours;
  return { time: e.time, tempC: i.air_temperature, windMs: i.wind_speed, windKmh: r1(i.wind_speed * 3.6), windFromDeg: i.wind_from_direction, humidityPct: i.relative_humidity, cloudPct: i.cloud_area_fraction, pressureHpa: i.air_pressure_at_sea_level,
    precipMm: d.next_1_hours?.details?.precipitation_amount ?? (d.next_6_hours?.details?.precipitation_amount !== undefined ? r1(d.next_6_hours.details.precipitation_amount / 6) : null), symbol: n?.summary?.symbol_code ?? null, stepHours: d.next_1_hours ? 1 : d.next_6_hours ? 6 : 12 };
};
const place = loc => ({ ...(loc.name ? { city: loc.name, country: loc.country } : {}), lat: loc.lat, lon: loc.lon });
const SRC_MET = "MET Norway Locationforecast (CC BY 4.0)";

export async function forecast(loc, hours) {
  const m = await metSeries(loc.lat, loc.lon);
  if (m.err) return fail(m.err);
  const now = Date.now();
  const rows = m.ts.filter(e => Date.parse(e.time) >= now - 3600_000).slice(0, hours).map(slot);
  const temps = rows.map(r => r.tempC).filter(x => x !== null);
  const sumP = rows.reduce((a, r) => a + (r.precipMm || 0), 0);
  const wet = rows.filter(r => (r.precipMm || 0) > 0.1).length;
  return { ok: true, location: place(loc), hours: rows.length, updatedAt: m.updated, summary: {
    minTempC: Math.min(...temps), maxTempC: Math.max(...temps), maxWindMs: Math.max(...rows.map(r => r.windMs)), totalPrecipMm: r1(sumP), wetHours: wet,
    text: `${Math.min(...temps)} to ${Math.max(...temps)} C, ${r1(sumP)} mm precipitation, peak wind ${Math.max(...rows.map(r => r.windMs))} m/s over the next ${rows.length} h` },
    forecast: rows, source: SRC_MET };
}
export async function current(loc) {
  const m = await metSeries(loc.lat, loc.lon);
  if (m.err) return fail(m.err);
  const now = Date.now();
  const e = m.ts.find(e => Date.parse(e.time) >= now - 1800_000) || m.ts[0];
  return { ok: true, location: place(loc), observedAs: "MET Norway model nowcast for the current hour (not a station observation)", ...slot(e), updatedAt: m.updated, source: SRC_MET };
}

// ---- NWS alerts ----
const alertRow = f => { const a = f.properties; return { event: a.event, severity: a.severity, urgency: a.urgency, certainty: a.certainty, headline: a.headline, area: a.areaDesc, onset: a.onset || a.effective, ends: a.ends || a.expires, sender: a.senderName, instruction: a.instruction ? a.instruction.slice(0, 600) : null, description: a.description ? a.description.slice(0, 800) : null, id: a.id }; };
export async function alerts(p) {
  const q = p.state ? `area=${encodeURIComponent(String(p.state).toUpperCase())}` : `point=${Number(p.lat).toFixed(4)},${Number(p.lon).toFixed(4)}`;
  const r = await getJson(`https://api.weather.gov/alerts/active?${q}`, 300_000);
  if (r.status === 400 || r.status === 404) return { found: false, ok: false, error: "NWS has no coverage for that location (United States and territories only)" };
  if (r.status !== 200 || !r.body?.features) return fail(`NWS returned HTTP ${r.status}`);
  const rows = r.body.features.map(alertRow);
  const order = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
  rows.sort((a, b) => (order[a.severity] ?? 5) - (order[b.severity] ?? 5));
  return { ok: true, query: p.state ? { state: String(p.state).toUpperCase() } : { lat: Number(p.lat), lon: Number(p.lon) }, count: rows.length, alerts: rows.slice(0, 50), truncated: rows.length > 50, note: rows.length ? undefined : "No active alerts.", source: "US National Weather Service (public domain)" };
}

// ---- USGS earthquakes ----
const rad = d => d * Math.PI / 180;
export const km = (a, b, c, d) => { const x = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
export async function quakes({ minMagnitude = 4.5, hours = 24, lat, lon, radiusKm = 500, limit = 100 }) {
  const lvl = minMagnitude <= 0 ? "all" : minMagnitude <= 1 ? "1.0" : minMagnitude <= 2.5 ? "2.5" : "4.5";
  const per = hours <= 1 ? "hour" : hours <= 24 ? "day" : "week";
  const r = await getJson(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${lvl}_${per}.geojson`, 300_000);
  if (r.status !== 200 || !r.body?.features) return fail(`USGS returned HTTP ${r.status}`);
  const since = Date.now() - hours * 3600_000, near = lat !== undefined && lon !== undefined;
  let rows = r.body.features.map(f => { const [lo, la, dep] = f.geometry.coordinates, q = f.properties;
    return { time: new Date(q.time).toISOString(), magnitude: q.mag, place: q.place, lat: la, lon: lo, depthKm: dep, tsunami: !!q.tsunami, alert: q.alert, felt: q.felt, url: q.url, ...(near ? { distanceKm: Math.round(km(lat, lon, la, lo)) } : {}) }; })
    .filter(q => Date.parse(q.time) >= since && q.magnitude !== null && q.magnitude >= minMagnitude && (!near || q.distanceKm <= radiusKm));
  rows.sort(near ? (a, b) => a.distanceKm - b.distanceKm : (a, b) => b.magnitude - a.magnitude);
  return { ok: true, query: { minMagnitude, hours, ...(near ? { lat, lon, radiusKm } : {}) }, count: rows.length, earthquakes: rows.slice(0, limit), truncated: rows.length > limit, source: "USGS Earthquake Hazards Program (public domain)" };
}

// ---- Nager.Date holidays ----
export async function holidays(country, year) {
  const r = await getJson(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, 6 * 3600_000);
  if (r.status === 404 || r.status === 400) return { found: false, ok: false, error: `no public-holiday data for country ${country} and year ${year}` };
  if (r.status !== 200 || !Array.isArray(r.body)) return fail(`Nager.Date returned HTTP ${r.status}`);
  const hol = r.body.map(h => ({ date: h.date, name: h.name, localName: h.localName, nationwide: h.global, regions: h.counties, types: h.types }));
  return { ok: true, country, year, count: hol.length, holidays: hol, source: "Nager.Date (open-source, MIT)" };
}

// ---- travel-check bundle ----
export async function travelCheck(city, date) {
  const loc = locate({ city });
  const day = date || new Date().toISOString().slice(0, 10);
  const year = Number(day.slice(0, 4));
  const [m, h, q] = await Promise.all([metSeries(loc.lat, loc.lon), holidays(loc.country, year).catch(() => null), quakes({ minMagnitude: 2.5, hours: 168, lat: loc.lat, lon: loc.lon, radiusKm: 300, limit: 10 }).catch(() => null)]);
  if (m.err) return fail(m.err);
  const rows = m.ts.filter(e => e.time.slice(0, 10) === day).map(slot);
  const lastDay = m.ts.at(-1).time.slice(0, 10), t0 = m.ts[0].time.slice(0, 10);
  const temps = rows.map(r => r.tempC);
  const weather = rows.length ? { date: day, minTempC: Math.min(...temps), maxTempC: Math.max(...temps), totalPrecipMm: r1(rows.reduce((a, r) => a + (r.precipMm || 0), 0)), maxWindMs: Math.max(...rows.map(r => r.windMs)), mainSymbol: rows[Math.floor(rows.length / 2)].symbol, hourly: rows }
    : { date: day, available: false, note: `Forecast covers ${t0} to ${lastDay} (about 9 days); date is outside that window.` };
  const dd = new Date(day + "T00:00:00Z").getTime();
  const nearHol = h?.ok ? h.holidays.filter(x => Math.abs(new Date(x.date + "T00:00:00Z").getTime() - dd) <= 3 * 86400_000) : [];
  const risks = [];
  if (weather.maxWindMs >= 14) risks.push("strong wind");
  if (weather.totalPrecipMm >= 10) risks.push("heavy precipitation");
  if (weather.maxTempC >= 35) risks.push("extreme heat");
  if (weather.minTempC <= -10) risks.push("severe cold");
  if (nearHol.some(x => x.nationwide)) risks.push("public holiday nearby (closures, crowds, price spikes)");
  if (q?.ok && q.earthquakes.some(e => e.magnitude >= 5)) risks.push("M5+ earthquake within 300 km in the past 7 days");
  return { ok: true, location: place(loc), date: day, weather, holidays: { country: loc.country, withinThreeDays: nearHol, ...(h?.ok ? {} : { note: "holiday data unavailable" }) },
    nearbyQuakes: q?.ok ? { radiusKm: 300, minMagnitude: 2.5, pastDays: 7, count: q.count, strongest: q.earthquakes.slice().sort((a, b) => b.magnitude - a.magnitude).slice(0, 5) } : { note: "earthquake data unavailable" },
    riskFlags: risks, source: "MET Norway (CC BY 4.0), Nager.Date, USGS (public domain)" };
}
