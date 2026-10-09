# x402-agent-tools

Six live pay-per-call APIs for AI agents. No API keys, no accounts: each call is paid in USDC on Base via the [x402](https://x402.org) protocol. Settlement uses the PayAI facilitator with automatic failover. Servers speak x402 v1 and v2, so both `@x402/fetch` and older v1 clients work. Listed on x402scan and agentcash.

| Service | Origin | What it does |
|---|---|---|
| BaseLens | https://baselens.imac2014ville.workers.dev | Honeypot checks, new-pool feed, tx explainer, wallet snapshots, cloud GPU prices and web-to-markdown for agents on Base. |
| DepVet | https://depvet.imac2014ville.workers.dev | Pre-install risk checks for npm and PyPI packages: typosquats, CVEs, licenses, OpenSSF Scorecard; OK/REVIEW/AVOID verdicts. |
| TokenGuard Base | https://tokenguard.imac2014ville.workers.dev | Is this Base token safe? Honeypot/rug checks and new launches pre-screened for honeypots. |
| MacroLens | https://macrolens.imac2014ville.workers.dev | Macro indicators for 200+ countries, country profiles, rankings, and Norway/France company registry lookups. |
| SkyFeed | https://skyfeed.imac2014ville.workers.dev | Global forecasts, current weather, US NWS alerts, USGS earthquakes, public holidays and a trip-day check. |
| ChainRead | https://chainread.imac2014ville.workers.dev | Cheap EVM reads on Base and Ethereum: gas, blocks, balances, ERC-20 and contract inspection, tx status, ENS/Basename. |

## Use from an agent

Any x402 client works. With `@x402/fetch` (JS):

```js
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.PRIVATE_KEY); // wallet holding USDC on Base
const client = new x402Client();
registerExactEvmScheme(client, { signer });
const fetchPaid = wrapFetchWithPayment(fetch, client);

const res = await fetchPaid("https://tokenguard.imac2014ville.workers.dev/token-risk?address=0x...");
console.log(await res.json());
```

Without a client, an unpaid call returns HTTP 402 with the payment requirements:

```sh
curl -i "https://depvet.imac2014ville.workers.dev/check?package=left-pad"
```

Parameter names for each endpoint are in that service's `/openapi.json`. Prices are per call in USD, read from the live OpenAPI documents. Every endpoint accepts GET and POST.

## BaseLens

Honeypot checks, new-pool feed, tx explainer, wallet snapshots, cloud GPU prices and web-to-markdown for agents on Base.

Origin: https://baselens.imac2014ville.workers.dev

| Endpoint | Description | Price (USDC) |
|---|---|---|
| `/new-pools` | New token launches on Base (sniper feed) | $0.01 |
| `/cloud-prices` | Cheapest cloud GPU price (Azure) | $0.02 |
| `/fetch` | Web page to markdown (scrape URL) | $0.004 |
| `/token-risk` | Honeypot check / rug pull check: is this Base token safe? | $0.02 |
| `/tx` | Explain a Base transaction | $0.01 |
| `/wallet` | Base wallet balance snapshot | $0.005 |
| `/x402check` | x402 endpoint health check | $0.01 |

```sh
curl -i https://baselens.imac2014ville.workers.dev/new-pools   # 402 + payment requirements; pay via an x402 client
```

## DepVet

Pre-install risk checks for npm and PyPI packages: typosquats, CVEs, licenses, OpenSSF Scorecard; OK/REVIEW/AVOID verdicts.

Origin: https://depvet.imac2014ville.workers.dev

| Endpoint | Description | Price (USDC) |
|---|---|---|
| `/report` | NPM supply chain attack check: full package risk report | $0.02 |
| `/check` | Malicious package / typosquat / CVE pre-install check | $0.005 |
| `/batch` | Dependency vulnerability scan for a lockfile (20 packages) | $0.05 |

```sh
curl -i https://depvet.imac2014ville.workers.dev/report   # 402 + payment requirements; pay via an x402 client
```

## TokenGuard Base

Is this Base token safe? Honeypot/rug checks and new launches pre-screened for honeypots. Source in `tokenguard/`.

Origin: https://tokenguard.imac2014ville.workers.dev

| Endpoint | Description | Price (USDC) |
|---|---|---|
| `/launch-scan` | New token launches on Base pre-screened for honeypots | $0.03 |
| `/token-risk` | Honeypot check / rug pull check: is this Base token safe? | $0.02 |
| `/new-pools` | New token launches on Base (sniper feed) | $0.01 |

```sh
curl -i https://tokenguard.imac2014ville.workers.dev/launch-scan   # 402 + payment requirements; pay via an x402 client
```

## MacroLens

Macro indicators for 200+ countries, country profiles, rankings, and Norway/France company registry lookups. Source in `macro/`.

Origin: https://macrolens.imac2014ville.workers.dev

| Endpoint | Description | Price (USDC) |
|---|---|---|
| `/company` | Official company registry lookup (Norway, France) | $0.02 |
| `/country-profile` | One-call economic snapshot of a country | $0.01 |
| `/compare` | Rank countries on a macro indicator | $0.01 |
| `/indicator` | Macro indicator time series for a country | $0.005 |

```sh
curl -i https://macrolens.imac2014ville.workers.dev/company   # 402 + payment requirements; pay via an x402 client
```

## SkyFeed

Global forecasts, current weather, US NWS alerts, USGS earthquakes, public holidays and a trip-day check. Source in `weather/`.

Origin: https://skyfeed.imac2014ville.workers.dev

| Endpoint | Description | Price (USDC) |
|---|---|---|
| `/forecast` | Hourly weather forecast, up to 48 hours | $0.005 |
| `/current` | Current weather at a place | $0.003 |
| `/alerts` | Active US National Weather Service alerts | $0.005 |
| `/earthquakes` | Recent earthquakes from USGS | $0.003 |
| `/holidays` | Public holidays by country and year | $0.002 |
| `/travel-check` | Weather + holidays + nearby quakes for a trip day | $0.01 |

```sh
curl -i https://skyfeed.imac2014ville.workers.dev/forecast   # 402 + payment requirements; pay via an x402 client
```

## ChainRead

Cheap EVM reads on Base and Ethereum: gas, blocks, balances, ERC-20 and contract inspection, tx status, ENS/Basename. Source in `chainread/`.

Origin: https://chainread.imac2014ville.workers.dev

| Endpoint | Description | Price (USDC) |
|---|---|---|
| `/gas` | Gas price and transaction cost in USD (Base, Ethereum) | $0.001 |
| `/block` | Latest or specific block (Base, Ethereum) | $0.001 |
| `/balance` | ETH + ERC-20 wallet balances | $0.002 |
| `/erc20` | ERC-20 token metadata, owner, proxy | $0.002 |
| `/contract` | Contract vs wallet, proxy, EIP-7702, selectors | $0.002 |
| `/tx-status` | Transaction status, confirmations, fee | $0.001 |
| `/resolve` | ENS and Basename to address | $0.002 |
| `/multicall-balances` | Bulk balances for up to 20 addresses | $0.005 |

```sh
curl -i https://chainread.imac2014ville.workers.dev/gas   # 402 + payment requirements; pay via an x402 client
```

## Discovery (/openapi.json, /.well-known/x402, /llms.txt)

Every service exposes the same discovery documents on its origin:

- `/openapi.json` - OpenAPI with per-operation `x-payment-info` prices (send `accept: application/json`)
- `/.well-known/x402` - x402 resource manifest
- `/llms.txt` - plain-text description for LLM agents

## Data sources & licenses

- World Bank Open Data - CC BY 4.0 (MacroLens)
- Brreg (Norwegian Business Registry) - NLOD (MacroLens)
- French company registry open data - Licence Ouverte (MacroLens)
- MET Norway weather - CC BY 4.0 (SkyFeed)
- US National Weather Service and USGS - public domain (SkyFeed)
- Nager.Date public holidays (SkyFeed)
- Base and Ethereum public RPC (BaseLens, TokenGuard, ChainRead)

## Source code

`tokenguard/`, `macro/`, `weather/` and `chainread/` hold the Cloudflare Worker sources (`src/*.js`, `wrangler.toml`, `package.json`) for TokenGuard, MacroLens, SkyFeed and ChainRead. No wallet keys are included.

## License

MIT - see [LICENSE](LICENSE). Copyright x402-agent-tools contributors.

## Built and operated with AI assistance

These services were designed, built and are operated with AI assistance (Claude), with a human owner reviewing and deploying. Outputs are informational, not financial, security or legal advice.
