// Upstream data access for MacroLens. All sources are keyless and allow commercial reuse (see landing page attributions).
const WB = "https://api.worldbank.org/v2";

export const INDICATORS = {
  gdp: ["NY.GDP.MKTP.CD", "GDP (current US$)", "USD"],
  gdp_ppp: ["NY.GDP.MKTP.PP.CD", "GDP, PPP (current international $)", "int$"],
  gdp_per_capita: ["NY.GDP.PCAP.CD", "GDP per capita (current US$)", "USD"],
  gdp_growth: ["NY.GDP.MKTP.KD.ZG", "GDP growth (annual %)", "%"],
  inflation: ["FP.CPI.TOTL.ZG", "Inflation, consumer prices (annual %)", "%"],
  unemployment: ["SL.UEM.TOTL.ZS", "Unemployment, total (% of labor force, ILO modeled)", "%"],
  youth_unemployment: ["SL.UEM.1524.ZS", "Unemployment, youth 15-24 (% of labor force, ILO modeled)", "%"],
  labor_force_participation: ["SL.TLF.CACT.ZS", "Labor force participation rate (% of population 15+, ILO modeled)", "%"],
  population: ["SP.POP.TOTL", "Population, total", "people"],
  population_growth: ["SP.POP.GROW", "Population growth (annual %)", "%"],
  urban_population_pct: ["SP.URB.TOTL.IN.ZS", "Urban population (% of total)", "%"],
  fertility_rate: ["SP.DYN.TFRT.IN", "Fertility rate, total (births per woman)", "births/woman"],
  life_expectancy: ["SP.DYN.LE00.IN", "Life expectancy at birth, total (years)", "years"],
  debt_to_gdp: ["GC.DOD.TOTL.GD.ZS", "Central government debt, total (% of GDP)", "% of GDP"],
  current_account: ["BN.CAB.XOKA.GD.ZS", "Current account balance (% of GDP)", "% of GDP"],
  exports: ["NE.EXP.GNFS.CD", "Exports of goods and services (current US$)", "USD"],
  imports: ["NE.IMP.GNFS.CD", "Imports of goods and services (current US$)", "USD"],
  trade_pct_gdp: ["NE.TRD.GNFS.ZS", "Trade (% of GDP)", "% of GDP"],
  fdi: ["BX.KLT.DINV.CD.WD", "Foreign direct investment, net inflows (current US$)", "USD"],
  fdi_pct_gdp: ["BX.KLT.DINV.WD.GD.ZS", "Foreign direct investment, net inflows (% of GDP)", "% of GDP"],
  gini: ["SI.POV.GINI", "Gini index (0 equal - 100 unequal)", "index"],
  interest_rate: ["FR.INR.LEND", "Lending interest rate (%)", "%"],
  real_interest_rate: ["FR.INR.RINR", "Real interest rate (%)", "%"],
  reserves: ["FI.RES.TOTL.CD", "Total reserves incl. gold (current US$)", "USD"],
  exchange_rate: ["PA.NUS.FCRF", "Official exchange rate (LCU per US$, period average)", "LCU/USD"],
  government_expense_pct: ["GC.XPN.TOTL.GD.ZS", "Expense (% of GDP)", "% of GDP"],
  tax_revenue_pct: ["GC.TAX.TOTL.GD.ZS", "Tax revenue (% of GDP)", "% of GDP"],
  military_pct: ["MS.MIL.XPND.GD.ZS", "Military expenditure (% of GDP)", "% of GDP"],
  internet_users_pct: ["IT.NET.USER.ZS", "Individuals using the Internet (% of population)", "%"],
  broad_money_pct: ["FM.LBL.BMNY.GD.ZS", "Broad money (% of GDP)", "% of GDP"],
  market_cap_pct: ["CM.MKT.LCAP.GD.ZS", "Market capitalization of listed companies (% of GDP)", "% of GDP"],
};
export const PROFILE_KEYS = ["gdp", "gdp_per_capita", "gdp_growth", "inflation", "unemployment", "population", "debt_to_gdp", "current_account", "exports", "imports", "fdi", "life_expectancy", "interest_rate"];
export const GROUPS = { G7: "US;JP;DE;GB;FR;IT;CA", BRICS: "BR;RU;IN;CN;ZA", NORDICS: "SE;NO;DK;FI;IS", EUROPE_BIG4: "DE;FR;IT;ES" };

const WB_CODE = /^[A-Z0-9]{2,6}(\.[A-Z0-9_]{1,10}){1,6}$/;
export function resolveIndicator(k) {
  const key = String(k || "").trim();
  const f = INDICATORS[key.toLowerCase().replace(/[\s-]+/g, "_")];
  if (f) return { key: key.toLowerCase().replace(/[\s-]+/g, "_"), code: f[0], name: f[1], units: f[2] };
  if (WB_CODE.test(key.toUpperCase())) return { key: key.toUpperCase(), code: key.toUpperCase(), name: null, units: null };
  return null;
}
export const isCountry = c => /^[A-Za-z]{2,3}$/.test(String(c || "").trim());

// ---- cache + fetch ----
const cache = new Map();
const TTL = 3600_000;
const retry1 = async fn => { try { return await fn(); } catch { return await fn(); } }; // single retry on timeout/network failure
const getJson = (url, headers) => retry1(() => getJson1(url, headers));
const csv = url => retry1(() => csv1(url));
async function getJson1(url, headers) {
  const hit = cache.get(url);
  if (hit && hit.exp > Date.now()) return hit.v;
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 8000);
  let r;
  try { r = await fetch(url, { signal: ac.signal, headers: { accept: "application/json", "user-agent": "MacroLens/1.0 (+https://macrolens.imac2014ville.workers.dev)", ...headers } }); }
  catch (e) { throw new Error(ac.signal.aborted ? "upstream timeout" : "upstream unreachable"); }
  finally { clearTimeout(t); }
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = null; }
  const v = { status: r.status, body, text };
  if (r.status < 500 && r.status !== 429) {
    if (cache.size > 600) cache.delete(cache.keys().next().value);
    cache.set(url, { v, exp: Date.now() + TTL });
  }
  return v;
}
async function csv1(url) {
  const hit = cache.get(url);
  if (hit && hit.exp > Date.now()) return hit.v;
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ac.signal });
    const v = { status: r.status, text: await r.text() };
    if (r.status < 500) cache.set(url, { v, exp: Date.now() + TTL });
    return v;
  } catch (e) { throw new Error((ac.signal.aborted ? "upstream timeout" : "upstream unreachable") + ": " + String(e?.message || e).slice(0, 80)); }
  finally { clearTimeout(t); }
}

// World Bank: returns {rows} or {found:false} or {ok:false}
async function wb(path, qs) {
  const u = `${WB}/${path}?format=json&per_page=200&${qs}`;
  const r = await getJson(u);
  if (r.status >= 500 || !r.body) return { ok: false, error: "World Bank API unavailable (" + r.status + ")" };
  const b = r.body;
  if (b[0]?.message) return { found: false, error: "World Bank: " + (b[0].message[0]?.value || "invalid country or indicator") };
  return { rows: Array.isArray(b[1]) ? b[1] : [], meta: b[0] };
}
const row = r => ({ year: Number(r.date), value: r.value });

export async function indicatorSeries(country, ind, years) {
  const res = await wb(`country/${country}/indicator/${ind.code}`, `mrv=${years}`);
  if (!res.rows) return res;
  if (!res.rows.length) return { found: false, error: "no data for this country/indicator" };
  const rows = res.rows;
  const series = rows.map(row).filter(x => x.value !== null).sort((a, b) => b.year - a.year);
  return { ok: true, country: { iso2: rows[0].country.id, iso3: rows[0].countryiso3code, name: rows[0].country.value },
    indicator: { key: ind.key, code: ind.code, name: rows[0].indicator.value, units: ind.units }, latest: series[0] ?? null, count: series.length, series,
    source: "World Bank Open Data (CC BY 4.0)", sourceUpdated: res.meta?.lastupdated ?? null,
    ...(series.length ? {} : { note: "No non-empty observations in the requested window; try a larger years value." }) };
}

export async function compare(countries, ind, order) {
  const res = await wb(`country/${countries.join(";")}/indicator/${ind.code}`, "mrnev=1");
  if (!res.rows) return res;
  const have = new Map(res.rows.map(r => [r.countryiso3code || r.country.id, r]));
  let items = res.rows.map(r => ({ country: r.country.value, iso2: r.country.id, iso3: r.countryiso3code, year: Number(r.date), value: r.value }));
  items = items.filter(i => i.value !== null).sort((a, b) => order === "asc" ? a.value - b.value : b.value - a.value).map((i, n) => ({ rank: n + 1, ...i }));
  const missing = countries.filter(c => !res.rows.some(r => r.country.id.toLowerCase() === c.toLowerCase() || (r.countryiso3code || "").toLowerCase() === c.toLowerCase()));
  if (!items.length) return { found: false, error: "no data for these countries/indicator" };
  return { ok: true, indicator: { key: ind.key, code: ind.code, name: res.rows[0].indicator.value, units: ind.units }, order: order === "asc" ? "ascending" : "descending",
    note: "Each value is the most recent available observation for that country; compare the year field.", ranking: items,
    ...(missing.length ? { noData: missing } : {}), source: "World Bank Open Data (CC BY 4.0)", sourceUpdated: res.meta?.lastupdated ?? null };
}

export async function profile(country) {
  const meta = await wb(`country/${country}`, "");
  if (!meta.rows) return meta;
  const c = meta.rows[0];
  if (!c) return { found: false, error: "unknown country" };
  const results = await Promise.all(PROFILE_KEYS.map(k => { const ind = resolveIndicator(k); return wb(`country/${country}/indicator/${ind.code}`, "mrnev=1").then(r => [ind, r]); }));
  const out = {};
  let fail = 0;
  for (const [ind, r] of results) {
    if (!r.rows) { if (r.ok === false) fail++; out[ind.key] = null; continue; }
    const x = r.rows[0];
    out[ind.key] = x && x.value !== null ? { value: x.value, year: Number(x.date), units: ind.units, name: ind.name } : null;
  }
  if (fail === results.length) return { ok: false, error: "World Bank API unavailable" };
  return { ok: true, country: { iso2: c.iso2Code, iso3: c.id, name: c.name, region: c.region?.value, incomeLevel: c.incomeLevel?.value, capital: c.capitalCity, isAggregate: c.region?.value === "Aggregates" },
    indicators: out, note: "Latest available annual value per indicator (years differ by indicator and country).", source: "World Bank Open Data (CC BY 4.0)", sourceUpdated: meta.meta?.lastupdated ?? null };
}

// ---- ECB key rates ----
const ECB = { deposit_facility: "DFR", main_refinancing: "MRR_FR", marginal_lending: "MLFR" };
export const ECB_KEYS = Object.keys(ECB);
export async function ecbRates(series, last) {
  const keys = series ? [series] : ECB_KEYS;
  const out = {};
  for (const k of keys) {
    const r = await csv(`https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.${ECB[k]}.LEV?lastNObservations=${last}&format=csvdata`);
    if (r.status !== 200) return { ok: false, error: "ECB data API unavailable (" + r.status + ")" };
    const lines = r.text.trim().split("\n"), h = lines[0].split(",");
    const iT = h.indexOf("TIME_PERIOD"), iV = h.indexOf("OBS_VALUE");
    out[k] = lines.slice(1).map(l => { const c = l.split(","); return { date: c[iT], ratePct: Number(c[iV]) }; }).sort((a, b) => b.date.localeCompare(a.date));
  }
  const firstKey = keys[0];
  return { ok: true, area: "Euro area (U2)", note: "Dates are the days the rate took effect (rates change only at policy decisions). Newest first.",
    latest: Object.fromEntries(keys.map(k => [k, out[k][0] ?? null])), history: out, source: "European Central Bank Data Portal", firstKey };
}

// ---- company registries ----
const normNO = e => ({
  country: "NO", registry: "Brønnøysund Register Centre, Enhetsregisteret", id: e.organisasjonsnummer, name: e.navn,
  legalForm: e.organisasjonsform ? { code: e.organisasjonsform.kode, description: e.organisasjonsform.beskrivelse } : null,
  status: e.konkurs ? "bankrupt" : e.underAvvikling ? "winding-up" : e.underTvangsavviklingEllerTvangsopplosning ? "forced-dissolution" : "active",
  incorporated: e.stiftelsesdato ?? null, registered: e.registreringsdatoEnhetsregisteret ?? null,
  industry: e.naeringskode1 ? { code: e.naeringskode1.kode, description: e.naeringskode1.beskrivelse } : null,
  employees: e.antallAnsatte ?? null, address: e.forretningsadresse ? [...(e.forretningsadresse.adresse || []), e.forretningsadresse.postnummer, e.forretningsadresse.poststed, e.forretningsadresse.land].filter(Boolean).join(", ") : null,
  website: e.hjemmeside ?? null, vatRegistered: e.registrertIMvaregisteret ?? null, shareCapital: e.kapital ? { amount: e.kapital.belop, currency: e.kapital.valuta, shares: e.kapital.antallAksjer ?? null } : null,
  sector: e.institusjonellSektorkode?.beskrivelse ?? null, lastAnnualAccounts: e.sisteInnsendteAarsregnskap ?? null,
  inGroup: e.erIKonsern ?? null, purpose: Array.isArray(e.aktivitet) ? e.aktivitet.join(" ") : null,
});
const naf = { A: "active", C: "ceased" };
function normFR(e) {
  const s = e.siege || {}, fin = e.finances || {}, yrs = Object.keys(fin).sort().reverse();
  return { country: "FR", registry: "Recherche d'entreprises (SIRENE / RNE), data.gouv.fr", id: e.siren, name: e.nom_complet,
    legalForm: { code: e.nature_juridique }, status: naf[e.etat_administratif] ?? e.etat_administratif, incorporated: e.date_creation, closed: e.date_fermeture ?? null,
    industry: { code: e.activite_principale, section: e.section_activite_principale }, employeesBand: e.tranche_effectif_salarie ?? null, employeesBandYear: e.annee_tranche_effectif_salarie ?? null,
    companySize: e.categorie_entreprise ?? null, establishments: e.nombre_etablissements ?? null, openEstablishments: e.nombre_etablissements_ouverts ?? null,
    hq: { siret: s.siret, address: s.geo_adresse || s.adresse || null, postalCode: s.code_postal ?? null, city: s.libelle_commune ?? null },
    officers: (e.dirigeants || []).slice(0, 10).map(d => d.denomination ? { name: d.denomination, role: d.qualite, type: d.type_dirigeant } : { name: [d.prenoms, d.nom].filter(Boolean).join(" "), role: d.qualite, birthYear: d.annee_de_naissance ?? null }),
    finances: yrs.slice(0, 3).map(y => ({ year: Number(y), revenue: fin[y].ca ?? null, netIncome: fin[y].resultat_net ?? null, currency: "EUR" })),
    vatNumbers: (e.tva || []).slice(0, 3), updated: e.date_mise_a_jour ?? null };
}
export async function company(country, id, query, limit) {
  if (country === "NO") {
    if (id) {
      const r = await getJson(`https://data.brreg.no/enhetsregisteret/api/enheter/${id}`);
      if (r.status === 404 || r.status === 410) return { found: false, error: "no entity with this organisasjonsnummer" };
      if (r.status !== 200 || !r.body) return { ok: false, error: "Brreg API unavailable (" + r.status + ")" };
      return { ok: true, company: normNO(r.body), source: "Brønnøysund Register Centre (NLOD)" };
    }
    const r = await getJson(`https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(query)}&size=${limit}`);
    if (r.status !== 200 || !r.body) return { ok: false, error: "Brreg API unavailable (" + r.status + ")" };
    const list = (r.body._embedded?.enheter || []).map(normNO);
    if (!list.length) return { found: false, error: "no matching entity" };
    return { ok: true, count: list.length, totalMatches: r.body.page?.totalElements ?? list.length, companies: list, source: "Brønnøysund Register Centre (NLOD)" };
  }
  const q = id || query;
  const r = await getJson(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&per_page=${id ? 1 : limit}`);
  if (r.status === 429) return { ok: false, error: "French registry rate limit, retry shortly" };
  if (r.status !== 200 || !r.body) return { ok: false, error: "French registry API unavailable (" + r.status + ")" };
  const res = r.body.results || [];
  if (id) {
    const e = res.find(x => x.siren === id.slice(0, 9)) || null;
    if (!e) return { found: false, error: "no entity with this SIREN/SIRET" };
    return { ok: true, company: normFR(e), source: "Recherche d'entreprises / SIRENE (Licence Ouverte 2.0)" };
  }
  if (!res.length) return { found: false, error: "no matching entity" };
  return { ok: true, count: res.length, totalMatches: r.body.total_results ?? res.length, companies: res.map(normFR), source: "Recherche d'entreprises / SIRENE (Licence Ouverte 2.0)" };
}
