// Resilient JSON-RPC batching with ordered public-RPC fallbacks (Base + Ethereum mainnet) and small ABI helpers.
import { keccak_256 } from "@noble/hashes/sha3";

export const CHAINS = {
  base: {
    name: "base", id: 8453, native: "ETH",
    rpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://base.drpc.org", "https://1rpc.io/base"],
    feed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", // Chainlink ETH/USD on Base
    weth: "0x4200000000000000000000000000000000000006",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    common: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "0x4200000000000000000000000000000000000006", "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"],
    ens: "0xB94704422c2a1E396835A571837Aa5AE53285a95",
  },
  ethereum: {
    name: "ethereum", id: 1, native: "ETH",
    rpcs: ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org", "https://1rpc.io/eth"],
    feed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // Chainlink ETH/USD on Ethereum
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    common: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
    ens: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
  },
};
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
export const ZERO = "0x0000000000000000000000000000000000000000";

const RATE = /rate|limit|too many|capacity|timeout|unavailable|archive|personal token/i;
export async function rpcBatch(chain, calls) {
  const rpcs = CHAINS[chain].rpcs, out = [];
  for (let i = 0; i < calls.length; i += 10) {
    const chunk = calls.slice(i, i + 10);
    const body = JSON.stringify(chunk.map(([method, params], id) => ({ jsonrpc: "2.0", id, method, params })));
    let res = null;
    for (let attempt = 0; attempt < rpcs.length + 2; attempt++) {
      try {
        const r = await fetch(rpcs[(attempt + i / 10) % rpcs.length], { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(7000) });
        const j = await r.json().catch(() => null);
        if (Array.isArray(j)) {
          const m = j.map(o => ({ ...o, id: Number(o.id) }));
          // retry on provider-side failures (rate limits, unavailable), not on genuine reverts
          const bad = m.some(o => o.error && (RATE.test(o.error.message || "") || o.error.code === -32046 || o.error.code === -32005));
          res = m;
          if (!bad) break;
        }
      } catch { /* network error / timeout: try next RPC */ }
      await new Promise(ok => setTimeout(ok, 150 * (attempt + 1)));
    }
    if (!Array.isArray(res)) throw new Error(`${chain} RPC unavailable (all providers failed or rate limited); retry shortly`);
    out.push(...chunk.map((_, j) => res.find(o => o.id === j) || {}));
  }
  return out;
}
export const rpc1 = async (chain, method, params = []) => (await rpcBatch(chain, [[method, params]]))[0];

// ---- ABI helpers ----
export const callTx = (to, data, block = "latest") => ["eth_call", [{ to, data }, block]];
export const pad = a => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
export const big = h => (h && h !== "0x" && /^0x[0-9a-fA-F]+$/.test(h) ? BigInt(h) : 0n);
export const word = (h, i = 0) => "0x" + (h || "").slice(2 + 64 * i, 2 + 64 * (i + 1));
export const addrOf = h => (h && h.length >= 66 ? "0x" + h.slice(26, 66) : null);
const hexText = h => new TextDecoder().decode(Uint8Array.from(h.match(/../g) || [], x => parseInt(x, 16)));
export function abiString(hex) {
  if (!hex || hex === "0x") return null;
  const b = hex.slice(2);
  try {
    if (b.length === 64) return hexText(b).replace(/\0+$/, "") || null;
    const len = parseInt(b.slice(64, 128), 16);
    if (!(len >= 0) || b.length < 128 + len * 2) return null;
    return hexText(b.slice(128, 128 + len * 2)).replace(/\0+/g, "") || null;
  } catch { return null; }
}
// format a bigint with decimals into a decimal string without float loss
export function fmtUnits(v, d) {
  const neg = v < 0n; if (neg) v = -v;
  const s = v.toString().padStart(d + 1, "0"), i = s.slice(0, s.length - d), f = s.slice(s.length - d).replace(/0+$/, "");
  return (neg ? "-" : "") + i + (f ? "." + f : "");
}
export const gwei = v => Number(v) / 1e9;
export const eth = v => Number(v) / 1e18;
export function keccakHex(bytes) { return [...keccak_256(bytes)].map(b => b.toString(16).padStart(2, "0")).join(""); }
export const selector = sig => keccakHex(new TextEncoder().encode(sig)).slice(0, 8);
export function namehash(name) {
  let node = new Uint8Array(32);
  if (name) for (const label of name.split(".").reverse()) {
    const lh = keccak_256(new TextEncoder().encode(label));
    const buf = new Uint8Array(64); buf.set(node); buf.set(lh, 32);
    node = keccak_256(buf);
  }
  return "0x" + [...node].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Chainlink ETH/USD price (null on failure).
export function parseFeed(r) {
  const h = r?.result; if (!h || h.length < 2 + 64 * 5) return null;
  const answer = BigInt.asIntN(256, big(word(h, 1)));
  const updatedAt = Number(big(word(h, 3)));
  return answer > 0n ? { usd: Number(answer) / 1e8, updatedAt } : null;
}
export const FEED_CALL = chain => callTx(CHAINS[chain].feed, "0xfeaf968c"); // latestRoundData()

// Multicall3.aggregate3 over [{to, data, allowFailure}]; returns [{success, data}]
export function encodeAggregate3(items) {
  const n = items.length;
  const elems = items.map(it => {
    const d = it.data.replace(/^0x/, ""), len = d.length / 2, padded = d.padEnd(Math.ceil(d.length / 64) * 64, "0");
    return pad(it.to) + (it.allowFailure === false ? "0".padStart(64, "0") : "1".padStart(64, "0")) + (0x60).toString(16).padStart(64, "0") + len.toString(16).padStart(64, "0") + padded;
  });
  let off = 32 * n; const offs = [];
  for (const e of elems) { offs.push(off.toString(16).padStart(64, "0")); off += e.length / 2; }
  return "0x82ad56cb" + (0x20).toString(16).padStart(64, "0") + n.toString(16).padStart(64, "0") + offs.join("") + elems.join("");
}
export function decodeAggregate3(hex) {
  const b = hex.replace(/^0x/, ""), rd = o => BigInt("0x" + b.slice(o * 2, o * 2 + 64)), at = o => Number(rd(o));
  const base = at(0), n = at(base), arr = base + 32, res = [];
  for (let i = 0; i < n; i++) {
    const e = arr + at(arr + 32 * i), ok = rd(e) === 1n, dOff = e + at(e + 32), len = at(dOff);
    res.push({ success: ok, data: "0x" + b.slice((dOff + 32) * 2, (dOff + 32 + len) * 2) });
  }
  return res;
}
