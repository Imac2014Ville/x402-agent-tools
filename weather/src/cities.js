// Built-in table of major world cities: "Name|ISO2|lat|lon[|alias;alias]". No external geocoder is used.
const RAW = `New York|US|40.713|-74.006|nyc;new york city
Los Angeles|US|34.052|-118.244|la
Chicago|US|41.878|-87.630
Houston|US|29.760|-95.370
Phoenix|US|33.449|-112.074
Philadelphia|US|39.953|-75.165
San Antonio|US|29.424|-98.494
San Diego|US|32.716|-117.161
Dallas|US|32.777|-96.797
San Jose|US|37.339|-121.894
Austin|US|30.267|-97.743
San Francisco|US|37.775|-122.419|sf
Seattle|US|47.606|-122.332
Denver|US|39.739|-104.990
Washington|US|38.907|-77.037|washington dc;washington d.c.
Boston|US|42.360|-71.059
Miami|US|25.762|-80.192
Atlanta|US|33.749|-84.388
Las Vegas|US|36.170|-115.140
Portland|US|45.515|-122.679
Minneapolis|US|44.978|-93.265
Detroit|US|42.331|-83.046
New Orleans|US|29.951|-90.072
Honolulu|US|21.307|-157.858
Anchorage|US|61.218|-149.900
Salt Lake City|US|40.761|-111.891
Nashville|US|36.163|-86.781
Orlando|US|28.538|-81.379
Toronto|CA|43.653|-79.383
Montreal|CA|45.502|-73.567
Vancouver|CA|49.283|-123.121
Calgary|CA|51.045|-114.072
Ottawa|CA|45.421|-75.697
Edmonton|CA|53.546|-113.494
Winnipeg|CA|49.895|-97.138
Mexico City|MX|19.433|-99.133
Guadalajara|MX|20.659|-103.350
Monterrey|MX|25.687|-100.316
Cancun|MX|21.161|-86.851
Guatemala City|GT|14.634|-90.507
San Jose CR|CR|9.929|-84.091|san jose costa rica
Panama City|PA|8.983|-79.517
Havana|CU|23.114|-82.366
Santo Domingo|DO|18.486|-69.931
San Juan|PR|18.466|-66.106
Kingston|JM|17.971|-76.793
Bogota|CO|4.711|-74.072
Medellin|CO|6.244|-75.581
Lima|PE|-12.046|-77.043
Quito|EC|-0.181|-78.468
Caracas|VE|10.481|-66.904
Santiago|CL|-33.449|-70.669
Buenos Aires|AR|-34.604|-58.382
Cordoba|AR|-31.420|-64.189
Montevideo|UY|-34.901|-56.165
Asuncion|PY|-25.264|-57.576
La Paz|BO|-16.490|-68.119
Sao Paulo|BR|-23.551|-46.633
Rio de Janeiro|BR|-22.907|-43.173|rio
Brasilia|BR|-15.794|-47.882
Salvador|BR|-12.971|-38.511
Fortaleza|BR|-3.732|-38.527
Manaus|BR|-3.119|-60.022
London|GB|51.507|-0.128
Manchester|GB|53.481|-2.243
Birmingham|GB|52.486|-1.890
Edinburgh|GB|55.953|-3.188
Glasgow|GB|55.864|-4.252
Dublin|IE|53.350|-6.260
Paris|FR|48.857|2.352
Marseille|FR|43.296|5.370
Lyon|FR|45.764|4.836
Nice|FR|43.710|7.262
Toulouse|FR|43.605|1.444
Berlin|DE|52.520|13.405
Munich|DE|48.137|11.575
Hamburg|DE|53.551|9.994
Frankfurt|DE|50.110|8.682
Cologne|DE|50.938|6.960
Stuttgart|DE|48.776|9.183
Madrid|ES|40.417|-3.704
Barcelona|ES|41.385|2.173
Valencia|ES|39.470|-0.376
Seville|ES|37.389|-5.984
Lisbon|PT|38.722|-9.139
Porto|PT|41.158|-8.629
Rome|IT|41.903|12.496
Milan|IT|45.464|9.190
Naples|IT|40.852|14.268
Venice|IT|45.441|12.316
Florence|IT|43.770|11.256
Turin|IT|45.070|7.687
Amsterdam|NL|52.368|4.904
Rotterdam|NL|51.924|4.478
Brussels|BE|50.850|4.352
Antwerp|BE|51.219|4.402
Luxembourg|LU|49.612|6.130
Zurich|CH|47.377|8.541
Geneva|CH|46.204|6.143
Bern|CH|46.948|7.447
Vienna|AT|48.208|16.373
Salzburg|AT|47.809|13.055
Prague|CZ|50.075|14.438
Warsaw|PL|52.230|21.012
Krakow|PL|50.065|19.945
Gdansk|PL|54.352|18.646
Budapest|HU|47.498|19.040
Bratislava|SK|48.149|17.107
Ljubljana|SI|46.057|14.506
Zagreb|HR|45.815|15.982
Split|HR|43.508|16.440
Belgrade|RS|44.787|20.457
Sarajevo|BA|43.856|18.413
Sofia|BG|42.698|23.322
Bucharest|RO|44.427|26.103
Athens|GR|37.984|23.728
Thessaloniki|GR|40.640|22.944
Istanbul|TR|41.008|28.978
Ankara|TR|39.933|32.860
Izmir|TR|38.423|27.143
Kyiv|UA|50.450|30.523|kiev
Minsk|BY|53.900|27.567
Moscow|RU|55.756|37.617
Saint Petersburg|RU|59.934|30.336|st petersburg;st. petersburg
Novosibirsk|RU|55.008|82.935
Vladivostok|RU|43.116|131.886
Tallinn|EE|59.437|24.754
Riga|LV|56.950|24.106
Vilnius|LT|54.687|25.280
Helsinki|FI|60.170|24.938
Stockholm|SE|59.329|18.069
Gothenburg|SE|57.709|11.975
Oslo|NO|59.914|10.752
Bergen|NO|60.391|5.322
Tromso|NO|69.649|18.956
Copenhagen|DK|55.676|12.568
Reykjavik|IS|64.147|-21.943
Valletta|MT|35.899|14.514
Nicosia|CY|35.185|33.382
Cairo|EG|30.044|31.236
Alexandria|EG|31.200|29.919
Casablanca|MA|33.573|-7.590
Marrakesh|MA|31.629|-7.981
Rabat|MA|34.021|-6.841
Algiers|DZ|36.754|3.059
Tunis|TN|36.807|10.182
Tripoli|LY|32.887|13.191
Lagos|NG|6.524|3.379
Abuja|NG|9.077|7.399
Accra|GH|5.604|-0.187
Abidjan|CI|5.360|-4.008
Dakar|SN|14.717|-17.467
Addis Ababa|ET|9.025|38.747
Nairobi|KE|-1.292|36.822
Mombasa|KE|-4.043|39.668
Dar es Salaam|TZ|-6.792|39.208
Kampala|UG|0.348|32.582
Kigali|RW|-1.944|30.062
Kinshasa|CD|-4.442|15.266
Luanda|AO|-8.839|13.289
Harare|ZW|-17.829|31.053
Lusaka|ZM|-15.387|28.323
Maputo|MZ|-25.966|32.573
Johannesburg|ZA|-26.204|28.047
Cape Town|ZA|-33.925|18.424
Durban|ZA|-29.859|31.022
Pretoria|ZA|-25.747|28.188
Windhoek|NA|-22.560|17.065
Antananarivo|MG|-18.879|47.508
Khartoum|SD|15.500|32.560
Tel Aviv|IL|32.085|34.782
Jerusalem|IL|31.768|35.214
Amman|JO|31.954|35.911
Beirut|LB|33.894|35.502
Damascus|SY|33.514|36.277
Baghdad|IQ|33.315|44.366
Tehran|IR|35.689|51.389
Riyadh|SA|24.714|46.675
Jeddah|SA|21.543|39.173
Mecca|SA|21.389|39.857
Kuwait City|KW|29.376|47.977
Doha|QA|25.285|51.531
Manama|BH|26.228|50.586
Dubai|AE|25.205|55.271
Abu Dhabi|AE|24.454|54.377
Muscat|OM|23.588|58.383
Sanaa|YE|15.369|44.191
Tbilisi|GE|41.716|44.783
Yerevan|AM|40.179|44.499
Baku|AZ|40.409|49.867
Tashkent|UZ|41.299|69.240
Almaty|KZ|43.238|76.945
Astana|KZ|51.169|71.449
Kabul|AF|34.528|69.172
Islamabad|PK|33.684|73.048
Karachi|PK|24.861|67.010
Lahore|PK|31.520|74.359
Delhi|IN|28.614|77.209|new delhi
Mumbai|IN|19.076|72.878|bombay
Bangalore|IN|12.972|77.595|bengaluru
Chennai|IN|13.083|80.271
Kolkata|IN|22.573|88.364|calcutta
Hyderabad|IN|17.385|78.487
Ahmedabad|IN|23.023|72.572
Pune|IN|18.520|73.857
Dhaka|BD|23.811|90.413
Colombo|LK|6.927|79.861
Kathmandu|NP|27.717|85.324
Thimphu|BT|27.472|89.639
Male|MV|4.175|73.509
Yangon|MM|16.841|96.173
Bangkok|TH|13.756|100.502
Chiang Mai|TH|18.788|98.986
Phuket|TH|7.880|98.392
Hanoi|VN|21.028|105.854
Ho Chi Minh City|VN|10.823|106.630|saigon
Phnom Penh|KH|11.556|104.928
Vientiane|LA|17.976|102.633
Kuala Lumpur|MY|3.139|101.687
Singapore|SG|1.352|103.820
Jakarta|ID|-6.208|106.846
Bali|ID|-8.409|115.189|denpasar
Surabaya|ID|-7.250|112.769
Manila|PH|14.600|120.984
Cebu|PH|10.317|123.891
Hong Kong|HK|22.319|114.169
Macau|MO|22.199|113.544
Taipei|TW|25.033|121.565
Shanghai|CN|31.230|121.474
Beijing|CN|39.904|116.407
Guangzhou|CN|23.129|113.264
Shenzhen|CN|22.543|114.058
Chengdu|CN|30.573|104.066
Chongqing|CN|29.563|106.551
Wuhan|CN|30.593|114.305
Xian|CN|34.341|108.940
Tianjin|CN|39.343|117.362
Hangzhou|CN|30.274|120.155
Tokyo|JP|35.677|139.650
Osaka|JP|34.694|135.502
Kyoto|JP|35.012|135.768
Nagoya|JP|35.181|136.906
Sapporo|JP|43.062|141.354
Fukuoka|JP|33.590|130.402
Seoul|KR|37.567|126.978
Busan|KR|35.180|129.076
Pyongyang|KP|39.039|125.763
Ulaanbaatar|MN|47.886|106.906
Sydney|AU|-33.869|151.209
Melbourne|AU|-37.814|144.963
Brisbane|AU|-27.470|153.026
Perth|AU|-31.951|115.857
Adelaide|AU|-34.929|138.601
Canberra|AU|-35.281|149.130
Darwin|AU|-12.463|130.846
Hobart|AU|-42.882|147.327
Auckland|NZ|-36.849|174.763
Wellington|NZ|-41.287|174.776
Christchurch|NZ|-43.532|172.636
Suva|FJ|-18.142|178.442
Port Moresby|PG|-9.443|147.180
Papeete|PF|-17.535|-149.570|tahiti
Noumea|NC|-22.276|166.458`;
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ,]/g, " ").replace(/\s+/g, " ").trim();
export const CITIES = RAW.split("\n").map(l => { const [name, cc, lat, lon, al] = l.split("|"); return { name, country: cc, lat: +lat, lon: +lon, names: [name, ...(al ? al.split(";") : [])].map(norm) }; });
const byName = new Map();
for (const c of CITIES) for (const n of c.names) if (!byName.has(n)) byName.set(n, c);
export function findCity(q) {
  const s = norm(q);
  if (!s) return null;
  if (byName.has(s)) return byName.get(s);
  const [a, b] = s.split(",").map(x => x.trim());
  if (b) { const hit = CITIES.find(c => c.names.includes(a) && (c.country.toLowerCase() === b || norm(c.country) === b)); if (hit) return hit; if (byName.has(a)) return byName.get(a); }
  return null;
}
