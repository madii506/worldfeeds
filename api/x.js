// $WORLD read-only API. Everything here is public data: GDACS alerts, the vault on Solana, the coin's market.
// GET /api/x?a=cfg | world | vault
const RPC = process.env.RPC_URL || 'https://solana-rpc.publicnode.com';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const env = k => (process.env[k] || '').trim();

const send = (res, code, body, maxAge = 0) => {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', maxAge ? `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 6}` : 'no-store');
  res.statusCode = code; res.end(JSON.stringify(body));
};
async function get(url, opt = {}, ms = 8000) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { ...opt, signal: ac.signal, headers: { 'user-agent': 'world-site/1.0 (+https://github.com/madii506)', accept: 'application/json', ...(opt.headers || {}) } }); if (!r.ok) throw new Error('http ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
const rpc = (method, params) => get(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
const rpcBatch = calls => get(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(calls.map(([method, params], id) => ({ jsonrpc: '2.0', id, method, params }))) }, 12000);

async function solPrice() {
  try { const j = await get(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`, {}, 5000); const p = j && j[SOL_MINT] && +j[SOL_MINT].usdPrice; if (p > 0) return p; } catch { }
  try { const j = await get('https://api.coinbase.com/v2/prices/SOL-USD/spot', {}, 5000); const p = +(j && j.data && j.data.amount); if (p > 0) return p; } catch { }
  return null;
}

// ---------------------------------------------------------------- the world right now (GDACS, fallback USGS)
const TYPES = { EQ: 'earthquake', TC: 'cyclone', FL: 'flood', VO: 'volcano', DR: 'drought', WF: 'wildfire', TS: 'tsunami' };
async function world() {
  try {
    const j = await get('https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP', {}, 9000);
    const ev = (j.features || []).map(f => { const p = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
      return { id: `${p.eventtype}${p.eventid}`, type: TYPES[p.eventtype] || 'event', code: p.eventtype, name: String(p.name || p.eventname || '').slice(0, 120), country: String(p.country || '').slice(0, 80),
        level: (p.alertlevel || 'Green').toLowerCase(), lon: +c[0], lat: +c[1], from: p.fromdate, to: p.todate,
        severity: p.severitydata ? String(p.severitydata.severitytext || '').slice(0, 140) : '', url: (p.url && p.url.report) || `https://www.gdacs.org/report.aspx?eventtype=${p.eventtype}&eventid=${p.eventid}` }; })
      .filter(e => isFinite(e.lat) && isFinite(e.lon));
    if (!ev.length) throw new Error('empty');
    return { ok: true, src: 'GDACS', at: Date.now(), events: ev };
  } catch (e) {
    try {
      const j = await get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson', {}, 8000);
      const ev = (j.features || []).slice(0, 120).map(f => { const p = f.properties || {}, c = f.geometry.coordinates;
        return { id: f.id, type: 'earthquake', code: 'EQ', name: `M${(+p.mag).toFixed(1)} earthquake`, country: String(p.place || '').slice(0, 80), level: p.alert === 'red' ? 'red' : p.alert === 'orange' ? 'orange' : 'green',
          lon: +c[0], lat: +c[1], from: new Date(p.time).toISOString(), to: new Date(p.time).toISOString(), severity: `Magnitude ${(+p.mag).toFixed(1)}`, url: p.url }; });
      return { ok: true, src: 'USGS', at: Date.now(), events: ev, note: 'GDACS did not answer; showing USGS earthquakes only' };
    } catch (e2) { return { ok: false, src: null, at: Date.now(), events: [], error: 'Neither GDACS nor USGS answered' }; }
  }
}

// ---------------------------------------------------------------- the vault: balance, and every transfer in and out
async function vault(addr) {
  const [bal, sigs] = await Promise.all([rpc('getBalance', [addr, { commitment: 'confirmed' }]), rpc('getSignaturesForAddress', [addr, { limit: 60 }])]);
  const list = (sigs.result || []).filter(s => !s.err);
  const txs = list.length ? await rpcBatch(list.map(s => ['getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]])) : [];
  const out = [], inn = []; let totalOut = 0, totalIn = 0;
  for (const r of (Array.isArray(txs) ? txs : [])) { const tx = r.result; if (!tx || !tx.meta) continue;
    const keys = tx.transaction.message.accountKeys.map(k => typeof k === 'string' ? k : k.pubkey), i = keys.indexOf(addr); if (i < 0) continue;
    const d = (tx.meta.postBalances[i] - tx.meta.preBalances[i]) / 1e9, sig = tx.transaction.signatures[0], t = tx.blockTime ? tx.blockTime * 1000 : null;
    if (d < -0.0005) { let to = null, best = 0; keys.forEach((k, j) => { if (j === i) return; const dj = tx.meta.postBalances[j] - tx.meta.preBalances[j]; if (dj > best) { best = dj; to = k; } });
      out.push({ sig, t, sol: -d, to }); totalOut += -d; }
    else if (d > 0.0000001) { inn.push({ sig, t, sol: d }); totalIn += d; } }
  let receipts = {}; try { receipts = JSON.parse(env('WORLD_RECEIPTS') || '{}'); } catch { }
  out.forEach(o => { if (receipts[o.sig]) o.receipt = String(receipts[o.sig]); });
  return { address: addr, balance: (bal.result && bal.result.value || 0) / 1e9, out, in: inn.slice(0, 20), totalOut, totalIn, seen: list.length };
}
async function coin(ca) {
  try { const j = await get(`https://api.dexscreener.com/tokens/v1/solana/${ca}`, {}, 7000); const p = (Array.isArray(j) ? j : []).sort((a, b) => ((b.liquidity || {}).usd || 0) - ((a.liquidity || {}).usd || 0))[0];
    if (!p) return { ca, listed: false };
    return { ca, listed: true, dex: p.dexId, price: +p.priceUsd || null, mcap: p.marketCap || p.fdv || null, vol24: (p.volume || {}).h24 || 0, liq: (p.liquidity || {}).usd || 0, change24: (p.priceChange || {}).h24 ?? null, url: p.url };
  } catch { return { ca, listed: null }; }
}

module.exports = async (req, res) => {
  const a = String((req.query && req.query.a) || 'cfg');
  try {
    if (a === 'cfg') { const sol = await solPrice(); return send(res, 200, { ok: true, ca: env('WORLD_CA'), x: env('WORLD_X'), vault: env('WORLD_VAULT'), cadence: env('WORLD_CADENCE') || 'daily', sol }, 60); }
    if (a === 'world') { const w = await world(); return send(res, 200, w, w.ok ? 600 : 30); }
    if (a === 'vault') {
      const v = env('WORLD_VAULT'), ca = env('WORLD_CA');
      const [sol, vv, cc] = await Promise.all([solPrice(), v ? vault(v).catch(e => ({ address: v, error: 'the Solana RPC did not answer' })) : null, ca ? coin(ca) : null]);
      return send(res, 200, { ok: true, open: !!v, sol, vault: vv, coin: cc }, 30);
    }
    return send(res, 400, { ok: false, error: 'unknown action' });
  } catch (e) { return send(res, 502, { ok: false, error: 'upstream error' }); }
};
