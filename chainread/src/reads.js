// The ChainRead tools: cheap EVM reads for Base and Ethereum mainnet.
import { CHAINS, MULTICALL3, ZERO, rpcBatch, rpc1, callTx, pad, big, word, addrOf, abiString, fmtUnits, gwei, eth, namehash, parseFeed, FEED_CALL, encodeAggregate3, decodeAggregate3 } from "./rpc.js";

const SEL = { decimals: "0x313ce567", symbol: "0x95d89b41", name: "0x06fdde03", totalSupply: "0x18160ddd", owner: "0x8da5cb5b", balanceOf: "0x70a08231" };
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const LEGACY_IMPL_SLOT = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3"; // OpenZeppelin legacy (Circle USDC)
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const ok = o => ({ ok: true, ...o });
const bad = error => ({ ok: false, error });
const slotAddr = h => { const a = addrOf(h ? "0x" + h.slice(2).padStart(64, "0") : null); return a && a !== ZERO ? a : null; };
const lc = a => a.toLowerCase();
const ageOf = ts => Math.max(0, Math.floor(Date.now() / 1000) - ts);

function badChain(r) { return r.error ? `RPC error: ${String(r.error.message || r.error.code).slice(0, 120)}` : null; }
const usdOf = (wei, px) => (px ? Math.round(eth(wei) * px.usd * 1e8) / 1e8 : null);

// ---------- /gas ----------
export async function gas(chain) {
  const [bn, gp, fh, blk, feed] = await rpcBatch(chain, [["eth_blockNumber", []], ["eth_gasPrice", []], ["eth_feeHistory", ["0x5", "latest", [25, 50, 75]]], ["eth_getBlockByNumber", ["latest", false]], FEED_CALL(chain)]);
  if (!blk.result) return bad("could not read latest block");
  const px = parseFeed(feed);
  const baseFee = big(blk.result.baseFeePerGas), gasPrice = big(gp.result);
  const rewards = (fh.result?.reward || []).map(r => r.map(big));
  const med = i => { const v = rewards.map(r => r[i]).filter(x => x !== undefined).sort((a, b) => (a < b ? -1 : 1)); return v.length ? v[Math.floor(v.length / 2)] : 0n; };
  const tip = { low: med(0), standard: med(1), fast: med(2) };
  const eff = baseFee + tip.standard > gasPrice ? baseFee + tip.standard : gasPrice;
  const cost = g => { const wei = eff * BigInt(g); return { gasUnits: g, costEth: eth(wei), costUsd: usdOf(wei, px) }; };
  return ok({ chain, blockNumber: Number(big(bn.result)), baseFeeGwei: gwei(baseFee), gasPriceGwei: gwei(gasPrice),
    priorityFeeGwei: { low: gwei(tip.low), standard: gwei(tip.standard), fast: gwei(tip.fast) },
    suggestedMaxFeeGwei: gwei(baseFee * 2n + tip.standard), suggestedMaxPriorityFeeGwei: gwei(tip.standard),
    gasUsedRatio: (fh.result?.gasUsedRatio || []).map(Number),
    ethUsd: px?.usd ?? null, ethUsdUpdatedAt: px?.updatedAt ?? null,
    estimates: { ethTransfer: cost(21000), erc20Transfer: cost(65000), dexSwap: cost(180000) },
    note: chain === "base" ? "Estimates cover L2 execution gas only; Base also charges a small L1 data fee on top." : "Estimates use the current effective gas price; real swap gas varies by route." });
}

// ---------- /block ----------
export async function block(chain, number) {
  let tag = "latest";
  if (number !== undefined && number !== "" && number !== null) {
    const s = String(number).toLowerCase();
    tag = ["latest", "finalized", "safe"].includes(s) ? s : "0x" + BigInt(s).toString(16);
  }
  const r = await rpc1(chain, "eth_getBlockByNumber", [tag, false]);
  if (r.error) return bad(badChain(r));
  const b = r.result;
  if (!b) return { ok: false, found: false, error: "block not found (not yet mined?)" };
  const gu = big(b.gasUsed), gl = big(b.gasLimit), ts = Number(big(b.timestamp));
  return ok({ chain, number: Number(big(b.number)), hash: b.hash, parentHash: b.parentHash, timestamp: ts, time: new Date(ts * 1000).toISOString(), ageSeconds: ageOf(ts),
    txCount: b.transactions.length, gasUsed: Number(gu), gasLimit: Number(gl), gasUtilizationPct: gl ? Math.round(Number(gu * 10000n / gl)) / 100 : null,
    baseFeeGwei: b.baseFeePerGas ? gwei(big(b.baseFeePerGas)) : null, miner: b.miner, size: Number(big(b.size)) });
}

// ---------- token meta helpers ----------
const metaCalls = t => [callTx(t, SEL.decimals), callTx(t, SEL.symbol), callTx(t, SEL.name)];
function parseMeta(rs) {
  const d = rs[0].result && rs[0].result !== "0x" ? Number(big(rs[0].result)) : null;
  return { decimals: d !== null && d <= 255 ? d : null, symbol: abiString(rs[1].result), name: abiString(rs[2].result) };
}

// ---------- /balance ----------
export async function balance(chain, address, tokens) {
  const list = (tokens && tokens.length ? tokens : CHAINS[chain].common).slice(0, 20);
  const calls = [["eth_getBalance", [address, "latest"]], FEED_CALL(chain)];
  for (const t of list) calls.push(callTx(t, SEL.balanceOf + pad(address)), ...metaCalls(t).slice(0, 2));
  const rs = await rpcBatch(chain, calls);
  if (rs[0].error) return bad(badChain(rs[0]));
  const px = parseFeed(rs[1]), nat = big(rs[0].result);
  const out = list.map((t, i) => {
    const [b, d, s] = rs.slice(2 + i * 3, 5 + i * 3);
    const dec = d.result && d.result !== "0x" ? Number(big(d.result)) : null;
    if (!b.result || b.result === "0x" || dec === null || dec > 255) return { token: t, error: "not an ERC-20 contract on " + chain };
    const raw = big(b.result);
    return { token: t, symbol: abiString(s.result), decimals: dec, balanceRaw: raw.toString(), balance: fmtUnits(raw, dec) };
  });
  return ok({ chain, address, native: { symbol: "ETH", balanceWei: nat.toString(), balance: fmtUnits(nat, 18), usd: usdOf(nat, px) }, ethUsd: px?.usd ?? null, tokens: out,
    note: tokens && tokens.length ? undefined : "No tokens passed; showing common tokens on this chain. Pass tokens=0x…,0x… to choose (max 20)." });
}

// ---------- proxy detection ----------
async function proxyInfo(chain, address, code) {
  const [i, b, a, lg] = await rpcBatch(chain, [["eth_getStorageAt", [address, IMPL_SLOT, "latest"]], ["eth_getStorageAt", [address, BEACON_SLOT, "latest"]], ["eth_getStorageAt", [address, ADMIN_SLOT, "latest"]], ["eth_getStorageAt", [address, LEGACY_IMPL_SLOT, "latest"]]]);
  let impl = i.result ? slotAddr(i.result) : null, kind = impl ? "EIP-1967" : null;
  if (!impl && lg.result && slotAddr(lg.result)) { impl = slotAddr(lg.result); kind = "OpenZeppelin legacy (zos)"; }
  const beacon = b.result ? slotAddr(b.result) : null;
  if (!impl && beacon) {
    const r = await rpc1(chain, "eth_call", [{ to: beacon, data: "0x5c60da1b" }, "latest"]); // implementation()
    impl = r.result ? slotAddr(r.result) : null; if (impl) kind = "EIP-1967 beacon";
  }
  const m = code && code.match(/^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3/i);
  if (!impl && m) { impl = "0x" + m[1]; kind = "EIP-1167 minimal proxy"; }
  return { isProxy: !!impl, kind, implementation: impl, beacon, admin: a.result ? slotAddr(a.result) : null };
}

// ---------- /erc20 ----------
export async function erc20(chain, token) {
  const rs = await rpcBatch(chain, [["eth_getCode", [token, "latest"]], ...metaCalls(token), callTx(token, SEL.totalSupply), callTx(token, SEL.owner), callTx(token, "0x893d20e8")]);
  if (rs[0].error) return bad(badChain(rs[0]));
  const code = rs[0].result;
  if (!code || code === "0x") return bad("no contract at this address on " + chain);
  const m = parseMeta(rs.slice(1, 4)), ts = rs[4].result && rs[4].result !== "0x" ? big(rs[4].result) : null;
  if (m.decimals === null || ts === null) return bad("not an ERC-20 (decimals()/totalSupply() missing)");
  const own = slotAddr(rs[5].result) || slotAddr(rs[6].result);
  const proxy = await proxyInfo(chain, token, code);
  return ok({ chain, token, name: m.name, symbol: m.symbol, decimals: m.decimals, totalSupplyRaw: ts.toString(), totalSupply: fmtUnits(ts, m.decimals),
    owner: own, ownershipRenounced: rs[5].result && rs[5].result !== "0x" && !own ? true : (own ? false : null),
    isProxy: proxy.isProxy, proxyKind: proxy.kind, implementation: proxy.implementation, proxyAdmin: proxy.admin });
}

// ---------- /contract ----------
const KNOWN = {
  a9059cbb: "transfer(address,uint256)", "23b872dd": "transferFrom(address,address,uint256)", "095ea7b3": "approve(address,uint256)", "70a08231": "balanceOf(address)", "18160ddd": "totalSupply()",
  "6352211e": "ownerOf(uint256)", "42842e0e": "safeTransferFrom(address,address,uint256)", f242432a: "safeTransferFrom(address,address,uint256,uint256,bytes)", "00fdd58e": "balanceOf(address,uint256)",
  "01ffc9a7": "supportsInterface(bytes4)", "8da5cb5b": "owner()", f2fde38b: "transferOwnership(address)", "715018a6": "renounceOwnership()",
  "40c10f19": "mint(address,uint256)", "42966c68": "burn(uint256)", "8456cb59": "pause()", "3f4ba83a": "unpause()", "3659cfe6": "upgradeTo(address)", "4f1ef286": "upgradeToAndCall(address,bytes)",
  ac9650d8: "multicall(bytes[])", "5ae401dc": "multicall(uint256,bytes[])", "1cff79cd": "execute(address,bytes)", "d0e30db0": "deposit()", "2e1a7d4d": "withdraw(uint256)",
  "52d1902d": "proxiableUUID()", "5c60da1b": "implementation()", "8129fc1c": "initialize()", "d505accf": "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)", "7ecebe00": "nonces(address)",
  "1626ba7e": "isValidSignature(bytes32,bytes)", "150b7a02": "onERC721Received(address,address,uint256,bytes)", "e9ae5c53": "execute(bytes32,bytes)", "34fcd5be": "executeBatch((address,uint256,bytes)[])",
};
function scanSelectors(code) {
  const found = new Set(), b = code.slice(2);
  for (let i = 0; i + 2 <= b.length; i += 2) {
    const op = parseInt(b.slice(i, i + 2), 16);
    if (op === 0x63 && i + 10 <= b.length) found.add(b.slice(i + 2, i + 10));
    if (op >= 0x60 && op <= 0x7f) i += (op - 0x5f) * 2;
  }
  return found;
}
export async function contract(chain, address) {
  const rs = await rpcBatch(chain, [["eth_getCode", [address, "latest"]], ["eth_getTransactionCount", [address, "latest"]], ["eth_getBalance", [address, "latest"]]]);
  if (rs[0].error) return bad(badChain(rs[0]));
  const code = rs[0].result || "0x", size = (code.length - 2) / 2;
  const nonce = Number(big(rs[1].result)), bal = big(rs[2].result);
  if (size === 0) return ok({ chain, address, isContract: false, codeSize: 0, kind: "EOA (no code)", nonce, balanceEth: fmtUnits(bal, 18), eip7702Delegated: false });
  const m7702 = size === 23 && /^0xef0100[0-9a-f]{40}$/i.test(code);
  if (m7702) return ok({ chain, address, isContract: false, codeSize: size, kind: "EOA with EIP-7702 delegation", nonce, balanceEth: fmtUnits(bal, 18), eip7702Delegated: true, delegatedTo: "0x" + code.slice(8) });
  const proxy = await proxyInfo(chain, address, code);
  let scan = scanSelectors(code), implCodeSize = null;
  if (proxy.implementation) {
    const ic = (await rpc1(chain, "eth_getCode", [proxy.implementation, "latest"])).result;
    if (ic && ic !== "0x") { implCodeSize = (ic.length - 2) / 2; scan = new Set([...scan, ...scanSelectors(ic)]); }
  }
  const sels = [...scan].filter(s => KNOWN[s]).map(s => ({ selector: "0x" + s, signature: KNOWN[s] }));
  const has = n => sels.some(s => s.signature.startsWith(n));
  const traits = [];
  if (has("transfer(") && has("balanceOf(address)") && has("totalSupply")) traits.push("erc20-like");
  if (has("ownerOf")) traits.push("erc721-like");
  if (has("balanceOf(address,uint256)")) traits.push("erc1155-like");
  if (has("owner()")) traits.push("ownable");
  if (has("mint")) traits.push("mintable");
  if (has("pause()")) traits.push("pausable");
  if (has("upgradeTo") || proxy.isProxy) traits.push("upgradeable");
  if (has("multicall")) traits.push("multicall");
  if (has("isValidSignature")) traits.push("smart-account-1271");
  return ok({ chain, address, isContract: true, codeSize: size, nonce, balanceEth: fmtUnits(bal, 18), eip7702Delegated: false,
    isProxy: proxy.isProxy, proxyKind: proxy.kind, implementation: proxy.implementation, implementationCodeSize: implCodeSize, proxyAdmin: proxy.admin,
    traits, selectorsOfInterest: sels, totalSelectorsFound: scan.size,
    note: "Selectors are read from the deployed bytecode (and the implementation's, for proxies); source verification is not checked." });
}

// ---------- /tx-status ----------
export async function txStatus(chain, hash) {
  if (!hash) { // default: first tx of a recent block
    let n = null;
    const head = await rpc1(chain, "eth_blockNumber", []); n = Number(big(head.result));
    for (let k = 0; k < 4 && !hash; k++) {
      const b = (await rpc1(chain, "eth_getBlockByNumber", ["0x" + (n - k).toString(16), true])).result;
      const t = b?.transactions?.find(x => x.type !== "0x7e"); // skip OP-stack system deposit txs
      if (t) hash = t.hash;
    }
    if (!hash) return bad("could not find a recent transaction");
  }
  const [r, t, head, feed] = await rpcBatch(chain, [["eth_getTransactionReceipt", [hash]], ["eth_getTransactionByHash", [hash]], ["eth_blockNumber", []], FEED_CALL(chain)]);
  if (r.error || t.error) return bad(badChain(r.error ? r : t));
  if (!t.result) return { ok: false, found: false, error: "transaction not found on " + chain };
  const tx = t.result, px = parseFeed(feed);
  if (!r.result) return ok({ chain, hash, status: "pending", from: tx.from, to: tx.to, nonce: Number(big(tx.nonce)), valueEth: fmtUnits(big(tx.value), 18), maxFeePerGasGwei: tx.maxFeePerGas ? gwei(big(tx.maxFeePerGas)) : null, confirmations: 0 });
  const rc = r.result, bn = Number(big(rc.blockNumber)), gu = big(rc.gasUsed), egp = big(rc.effectiveGasPrice);
  const l1 = big(rc.l1Fee), fee = gu * egp + l1;
  return ok({ chain, hash, status: rc.status === "0x1" ? "success" : "failed", blockNumber: bn, blockHash: rc.blockHash, confirmations: Math.max(1, Number(big(head.result)) - bn + 1),
    from: rc.from, to: rc.to, contractCreated: rc.contractAddress, valueEth: fmtUnits(big(tx.value), 18), gasUsed: Number(gu), gasLimit: Number(big(tx.gas)), effectiveGasPriceGwei: gwei(egp),
    feeWei: fee.toString(), feeEth: eth(fee), feeUsd: usdOf(fee, px), l1FeeWei: chain === "base" ? l1.toString() : undefined, txType: Number(big(tx.type)), logCount: rc.logs.length });
}

// ---------- /resolve ----------
export async function resolve(name) {
  const n = name.toLowerCase().trim();
  const chain = n.endsWith(".base.eth") ? "base" : "ethereum"; // Basenames live on Base's registry; other .eth on ENS mainnet
  const node = namehash(n), reg = CHAINS[chain].ens;
  const r1 = await rpc1(chain, "eth_call", [{ to: reg, data: "0x0178b8bf" + node.slice(2) }, "latest"]); // resolver(node)
  if (r1.error) return bad(badChain(r1));
  const resolver = slotAddr(r1.result);
  if (!resolver) return { ok: false, found: false, error: `${n} has no resolver (name not registered or not set up)` };
  const r2 = await rpc1(chain, "eth_call", [{ to: resolver, data: "0x3b3b57de" + node.slice(2) }, "latest"]); // addr(node)
  if (r2.error) {
    if (/offchain|0x556f1830/i.test(JSON.stringify(r2.error))) return bad("name uses an offchain (CCIP-read) resolver, which is not supported");
    return { ok: false, found: false, error: `resolver cannot resolve ${n} to an address` };
  }
  const a = slotAddr(r2.result);
  if (!a) return { ok: false, found: false, error: `${n} is registered but has no address record` };
  return ok({ name: n, address: a, resolver, resolvedOn: chain, registry: reg, note: "Names are lowercased; full ENS normalization (emoji/Unicode) is not applied." });
}

// ---------- /multicall-balances ----------
export async function multicallBalances(chain, addresses, token) {
  const items = [];
  if (token) items.push({ to: token, data: SEL.decimals }, { to: token, data: SEL.symbol });
  for (const a of addresses) items.push(token ? { to: token, data: SEL.balanceOf + pad(a) } : { to: MULTICALL3, data: "0x4d2301cc" + pad(a) });
  const [r, feed] = await rpcBatch(chain, [callTx(MULTICALL3, encodeAggregate3(items)), FEED_CALL(chain)]);
  if (r.error || !r.result) return bad(r.error ? badChain(r) : "multicall failed");
  let res; try { res = decodeAggregate3(r.result); } catch { return bad("could not decode multicall result"); }
  const px = parseFeed(feed);
  let dec = 18, symbol = "ETH";
  if (token) {
    const d = res[0];
    if (!d.success || d.data === "0x") return bad("not an ERC-20 (decimals() missing) on " + chain);
    dec = Number(big(d.data)); symbol = abiString(res[1].data);
  }
  const off = token ? 2 : 0;
  const balances = addresses.map((a, i) => {
    const x = res[off + i];
    if (!x?.success || x.data === "0x") return { address: a, error: "call failed" };
    const raw = big(x.data);
    return { address: a, balanceRaw: raw.toString(), balance: fmtUnits(raw, dec), ...(token ? {} : { usd: usdOf(raw, px) }) };
  });
  const total = balances.reduce((s, b) => s + (b.balanceRaw ? BigInt(b.balanceRaw) : 0n), 0n);
  return ok({ chain, asset: token ? { token, symbol, decimals: dec } : { token: null, symbol: "ETH", decimals: 18 }, count: balances.length, total: fmtUnits(total, dec), balances, ethUsd: px?.usd ?? null });
}
