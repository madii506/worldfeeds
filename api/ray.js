// $WORLD on Raydium LaunchLab: the WORLD launchpad (1% of every curve trade, claimed into the kitchen's vault) and the coin.
// GET  a=pad&admin=|id= (the launchpad and the SOL waiting in its fee vault) · a=coin (the coin on its curve) · a=t (the token's metadata)
// POST a=buildPad · a=buildLaunch · a=claim · a=send   (every transaction is built here and signed in the visitor's own wallet)
// Same engine as 1ndex / p4d, verified on mainnet: createPlatformConfig (feeRate 1%, creatorFeeRate 0, LP 50% burned / 50% platform fee key),
// createLaunchpad on the WSOL config (supply 1B, 793.1M sold, raise 85 SOL, CPMM migration), claimVaultPlatformFee.
const { Connection, PublicKey, Keypair, SystemProgram, Transaction } = require('@solana/web3.js');
const BN = require('bn.js');
const R = require('@raydium-io/raydium-sdk-v2');

const RPC = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const WSOL = new PublicKey('So11111111111111111111111111111111111111112');
const PROGRAM = R.LAUNCHPAD_PROGRAM, RAYDIUM_PLATFORM = R.LAUNCHPAD_PLATFORM;
const CONFIG = R.getPdaLaunchpadConfigId(PROGRAM, WSOL, 0, 0).publicKey;
const SUPPLY = new BN('1000000000000000'), SELL = new BN('793100000000000'), RAISE_SOL = 85, PPM = 1e6;
const conn = new Connection(RPC, 'confirmed');
const env = k => (process.env[k] || '').trim();

const out = (res, code, body, cache) => { res.statusCode = code; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', cache || 'no-store'); res.end(JSON.stringify(body)); };
const host = req => env('WORLD_HOST') || ('https://' + (req.headers['x-forwarded-host'] || req.headers.host));
const body = req => new Promise(ok => { if (req.body) return ok(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); let d = ''; req.on('data', c => d += c); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });
const str = b => Buffer.from(b).toString('utf8').replace(/\0/g, '').trim();
const pk = (s, what) => { try { return new PublicKey(String(s)); } catch { throw new Error(what || 'bad address'); } };
const padIdOf = admin => R.getPdaPlatformId(PROGRAM, admin).publicKey;
const vaultOf = padId => R.getPdaPlatformVault(PROGRAM, padId, WSOL).publicKey;
const pct = n => +(+n.toString() / PPM * 100).toFixed(4);

let chainCache = null;
async function chain() {
  if (chainCache && Date.now() - chainCache.t < 60000) return chainCache.v;
  const [ca, pa] = await conn.getMultipleAccountsInfo([CONFIG, RAYDIUM_PLATFORM]);
  if (!ca) throw new Error('LaunchLab config not found');
  const v = { cfg: R.LaunchpadConfig.decode(ca.data), ray: pa ? R.PlatformConfig.decode(pa.data) : null };
  chainCache = { t: Date.now(), v }; return v;
}
function decodePad(id, data) { const p = R.PlatformConfig.decode(data);
  return { id: id.toBase58(), name: str(p.name), web: str(p.web), img: str(p.img), feePct: pct(p.feeRate), creatorFeePct: pct(p.creatorFeeRate), lp: { burn: pct(p.burnScale), platform: pct(p.platformScale), creator: pct(p.creatorScale) }, claimWallet: p.platformClaimFeeWallet ? p.platformClaimFeeWallet.toBase58() : null }; }
async function pad(q) {
  const raw = q.get('id') || (q.get('admin') ? null : env('WORLD_PAD'));
  const id = raw ? pk(raw, 'bad launchpad id') : padIdOf(pk(q.get('admin'), 'bad wallet'));
  const [acc, vault] = await conn.getMultipleAccountsInfo([id, vaultOf(id)]);
  if (!acc || !acc.owner.equals(PROGRAM)) return { exists: false, id: id.toBase58() };
  let unclaimedSol = 0; if (vault && vault.data.length >= 72) unclaimedSol = Number(vault.data.readBigUInt64LE(64)) / 1e9;
  return { exists: true, ...decodePad(id, acc.data), vault: vaultOf(id).toBase58(), unclaimedSol };
}
async function coin() {
  const ca = env('WORLD_CA'); if (!ca) return { live: false };
  const mint = pk(ca, 'bad WORLD_CA'), pool = R.getPdaLaunchpadPoolId(PROGRAM, mint, WSOL).publicKey;
  const acc = await conn.getAccountInfo(pool); if (!acc) return { live: false, mint: ca, note: 'no LaunchLab pool for this mint' };
  const p = R.LaunchpadPool.decode(acc.data), rB = +p.realB.toString(), goal = +p.totalFundRaisingB.toString();
  return { live: true, mint: ca, pool: pool.toBase58(), pad: p.platformId.toBase58(), graduated: p.status > 0, progress: goal ? rB / goal : 0, raisedSol: rB / 1e9, raiseSol: goal / 1e9 };
}
const fits = t => { try { t.serialize({ requireAllSignatures: false, verifySignatures: false }); return true; } catch { return false; } };
async function finish(txs, wallet, signers, simulate) {
  const { blockhash } = await conn.getLatestBlockhash('confirmed');
  const list = txs.map(tx => { const t = new Transaction(); t.add(...tx.instructions); t.feePayer = wallet; t.recentBlockhash = blockhash;
    const need = signers.filter(s => t.instructions.some(ix => ix.keys.some(k => k.isSigner && k.pubkey.equals(s.publicKey)))); if (need.length) t.partialSign(...need); return t; });
  if (list.some(t => !fits(t))) throw new Error('transaction too large');
  let sim = null; if (simulate) sim = await Promise.all(list.slice(0, 1).map(async t => { const r = await conn.simulateTransaction(t); return { err: r.value.err, units: r.value.unitsConsumed, logs: (r.value.logs || []).slice(-14) }; }));
  return { txs: list.map(t => Buffer.from(t.serialize({ requireAllSignatures: false, verifySignatures: false })).toString('base64')), sim };
}
const txsOf = m => m.transactions ? m.transactions : [{ instructions: m.transaction && m.transaction.instructions && m.transaction.instructions.length ? m.transaction.instructions : m.builder.allInstructions }];
const sdk = owner => R.Raydium.load({ connection: conn, owner, cluster: 'mainnet', disableLoadToken: true, disableFeatureCheck: true, blockhashCommitment: 'confirmed' });

// the WORLD launchpad: 1% of every curve trade to this wallet (the vault), no creator fee; at graduation half the LP is burned and half kept as a Raydium fee key
async function buildPad(req) {
  const b = await body(req), wallet = pk(b.wallet, 'connect a wallet first'), id = padIdOf(wallet);
  if (await conn.getAccountInfo(id)) throw new Error(`this wallet already has a launchpad (${id.toBase58()}). one per wallet.`);
  const { ray } = await chain(); if (!ray) throw new Error('could not read Raydium’s platform settings');
  const raydium = await sdk(wallet), burn = 50 * 1e4;
  const made = await raydium.launchpad.createPlatformConfig({
    programId: PROGRAM, platformAdmin: wallet, platformClaimFeeWallet: wallet, platformLockNftWallet: wallet, platformVestingWallet: wallet,
    cpConfigId: ray.cpConfigId, migrateCpLockNftScale: { platformScale: new BN(PPM - burn), creatorScale: new BN(0), burnScale: new BN(burn) },
    transferFeeExtensionAuth: wallet, creatorFeeRate: new BN(0), feeRate: new BN(1e4),
    name: 'WORLD', web: host(req), img: host(req) + '/assets/pfp.png', txVersion: R.TxVersion.LEGACY, feePayer: wallet,
  });
  return { pad: id.toBase58(), ...(await finish(txsOf(made), wallet, [], !!b.simulate)) };
}
async function buildLaunch(req) {
  const b = await body(req), wallet = pk(b.wallet, 'connect a wallet first');
  const padId = b.pad ? pk(b.pad, 'bad launchpad') : (env('WORLD_PAD') ? pk(env('WORLD_PAD')) : padIdOf(wallet));
  const padAcc = await conn.getAccountInfo(padId); if (!padAcc || !padAcc.owner.equals(PROGRAM)) throw new Error('open the WORLD launchpad first (step 1)');
  const p = decodePad(padId, padAcc.data); if (p.feePct !== 1) throw new Error(`this launchpad's fee is ${p.feePct}%, not 1%`);
  const { cfg } = await chain(), uri = host(req) + '/api/ray?a=t';
  const buySol = Math.max(0, +b.buySol || 0); if (buySol > 20) throw new Error('the first buy is capped at 20 SOL here');
  const mint = Keypair.generate(), raydium = await sdk(wallet);
  const { transactions, extInfo } = await raydium.launchpad.createLaunchpad({
    programId: PROGRAM, mintA: mint.publicKey, decimals: 6, name: 'WORLD', symbol: 'WORLD', uri, migrateType: 'cpmm', configId: CONFIG, configInfo: cfg, mintBDecimals: 9, platformId: padId,
    txVersion: R.TxVersion.LEGACY, slippage: new BN(100), buyAmount: new BN(Math.round(buySol * 1e9)), createOnly: buySol === 0,
    supply: SUPPLY, totalSellA: SELL, totalFundRaisingB: new BN(RAISE_SOL * 1e9), totalLockedAmount: new BN(0), cliffPeriod: new BN(0), unlockPeriod: new BN(0),
    extraSigners: [mint], feePayer: wallet, computeBudgetConfig: { units: 600000, microLamports: 60000 },
  });
  const r = await finish(transactions, wallet, [mint], !!b.simulate);
  return { mint: mint.publicKey.toBase58(), pool: (extInfo && extInfo.address && extInfo.address.poolId && extInfo.address.poolId.toBase58()) || R.getPdaLaunchpadPoolId(PROGRAM, mint.publicKey, WSOL).publicKey.toBase58(), uri, ...r };
}
async function claim(req) {
  const b = await body(req), wallet = pk(b.wallet, 'connect a wallet first'), id = padIdOf(wallet);
  if (!(await conn.getAccountInfo(id))) throw new Error('this wallet has no launchpad');
  const raydium = await sdk(wallet);
  const made = await raydium.launchpad.claimVaultPlatformFee({ programId: PROGRAM, platformId: id, mintB: WSOL, claimFeeWallet: wallet, txVersion: R.TxVersion.LEGACY, feePayer: wallet });
  return finish(txsOf(made), wallet, [], !!b.simulate);
}
async function sendTxs(req) {
  const b = await body(req); if (!Array.isArray(b.txs) || !b.txs.length || b.txs.length > 6) throw new Error('nothing to send');
  const sigs = [];
  for (const t of b.txs) { const sig = await conn.sendRawTransaction(Buffer.from(t, 'base64'), { skipPreflight: false, maxRetries: 3 }); sigs.push(sig);
    for (let k = 0; k < 30; k++) { const s = (await conn.getSignatureStatuses([sig])).value[0]; if (s && s.err) throw new Error('transaction failed: ' + JSON.stringify(s.err)); if (s && /confirmed|finalized/.test(s.confirmationStatus || '')) break; await new Promise(r => setTimeout(r, 800)); } }
  return { sigs };
}
const meta = req => ({ name: 'WORLD', symbol: 'WORLD', image: host(req) + '/assets/pfp.png', external_url: host(req), createdOn: host(req),
  description: `every trade feeds the world. 1% of every $WORLD trade goes to World Central Kitchen, and every send is public: ${host(req)}` });

module.exports = async (req, res) => { res.setHeader('access-control-allow-origin', '*');
  const q = new URL(req.url, 'http://x').searchParams, a = q.get('a');
  try {
    if (a === 'pad') return out(res, 200, await pad(q), 's-maxage=15, stale-while-revalidate=60');
    if (a === 'coin') return out(res, 200, await coin(), 's-maxage=15, stale-while-revalidate=60');
    if (a === 't') return out(res, 200, meta(req), 'public, max-age=3600');
    if (req.method === 'POST' && a === 'buildPad') return out(res, 200, await buildPad(req));
    if (req.method === 'POST' && a === 'buildLaunch') return out(res, 200, await buildLaunch(req));
    if (req.method === 'POST' && a === 'claim') return out(res, 200, await claim(req));
    if (req.method === 'POST' && a === 'send') return out(res, 200, await sendTxs(req));
    return out(res, 400, { error: 'unknown action' });
  } catch (e) { return out(res, 400, { error: String(e && e.message || e).slice(0, 300) }); }
};
