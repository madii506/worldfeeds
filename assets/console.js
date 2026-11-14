// WORLD console: open the launchpad, launch $WORLD, claim the kitchen's fees. Every transaction is signed in the visitor's own wallet.
(() => {
  const $ = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { wallet: null, p: null, pad: null, mint: null }, short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
  const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200); };
  const stat = id => (m, c = '') => { const el = $(id); el.className = 'stat ' + c; el.innerHTML = m; };
  async function api(a, body, q = '') { const r = await fetch('/api/ray?a=' + a + q, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({ error: 'bad response' })); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j; }
  const providers = () => [['Phantom', window.phantom && window.phantom.solana], ['Solflare', window.solflare && window.solflare.isSolflare && window.solflare], ['Backpack', window.backpack]].filter(([, p]) => p);
  async function connect() { if (S.wallet) return S.wallet; const ps = providers(); if (!ps.length) { toast('no Solana wallet found: open this page in Phantom, Solflare or Backpack'); throw new Error('no wallet'); }
    const [name, p] = ps[0]; const r = await p.connect(); S.wallet = ((r && r.publicKey) || p.publicKey).toString(); S.p = p; $('#connect').textContent = name + ' · ' + short(S.wallet); refresh(); return S.wallet; }
  $('#connect').onclick = () => connect().catch(() => {});
  const b64 = u => { let s = ''; u.forEach(c => s += String.fromCharCode(c)); return btoa(s); }, unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function signSend(list, st) { const txs = list.map(t => solanaWeb3.Transaction.from(unb64(t)));
    st('check your wallet…'); const signed = S.p.signAllTransactions ? await S.p.signAllTransactions(txs) : [await S.p.signTransaction(txs[0])];
    st('sending…'); return api('send', { txs: signed.map(t => b64(t.serialize())) }); }
  const tx = sig => `<a href="https://solscan.io/tx/${sig}" target="_blank" rel="noopener">${short(sig)} ↗</a>`;
  const env = () => { $('#envBox').textContent = S.wallet ? [`WORLD_VAULT=${S.wallet}`, `WORLD_PAD=${S.pad || '(open the launchpad first)'}`, `WORLD_CA=${S.mint || '(launch $WORLD first)'}`, 'WORLD_X=(your X handle)'].join('\n') : 'connect the vault wallet and launch first.'; };
  async function refresh() { if (!S.wallet) return; try { const p = await api('pad', null, '&admin=' + S.wallet);
      S.pad = p.exists ? p.id : null;
      $('#padInfo').textContent = p.exists ? `launchpad ${short(p.id)} · ${p.feePct}% fee · LP ${p.lp.burn}% burned` : 'this wallet has no launchpad yet';
      $('#padBtn').disabled = !!p.exists; $('#vaultInfo').textContent = p.exists ? `${p.unclaimedSol.toFixed(4)} SOL waiting in LaunchLab's fee vault` : ''; env();
    } catch (e) { $('#padInfo').textContent = e.message; } }
  $('#padBtn').onclick = async () => { const st = stat('#padStat'); try { await connect(); st('building the LaunchLab transaction…');
      const r = await api('buildPad', { wallet: S.wallet }); const s = await signSend(r.txs, st); S.pad = r.pad;
      st(`the WORLD launchpad is open: <b>${esc(r.pad)}</b>\ntransaction ${tx(s.sigs[0])}`, 'ok'); env(); setTimeout(refresh, 2500); } catch (e) { st(esc(e.message), 'err'); } };
  $('#launchBtn').onclick = async () => { const st = stat('#launchStat'); try { await connect(); const buy = parseFloat($('#buySol').value || '0');
      if (!(buy >= 0) || buy > 20) throw new Error('the opening buy has to be between 0 and 20 SOL');
      st('building the launch…'); const r = await api('buildLaunch', { wallet: S.wallet, pad: S.pad, buySol: buy || 0 }); const s = await signSend(r.txs, st); S.mint = r.mint;
      st(`$WORLD is live: <b>${esc(r.mint)}</b>\ntransaction ${s.sigs.map(tx).join(' · ')}\n<a href="https://raydium.io/launchpad/token/?mint=${esc(r.mint)}" target="_blank" rel="noopener">see it on Raydium ↗</a>`, 'ok'); env(); } catch (e) { st(esc(e.message), 'err'); } };
  $('#claimBtn').onclick = async () => { const st = stat('#claimStat'); try { await connect(); st('building the claim…'); const r = await api('claim', { wallet: S.wallet }); const s = await signSend(r.txs, st); st(`claimed into this wallet. ${tx(s.sigs[0])}`, 'ok'); setTimeout(refresh, 2500); } catch (e) { st(esc(e.message), 'err'); } };
  const ps = providers(); if (ps.length && ps[0][1].connect) ps[0][1].connect({ onlyIfTrusted: true }).then(r => { if (r && r.publicKey) { S.wallet = r.publicKey.toString(); S.p = ps[0][1]; $('#connect').textContent = ps[0][0] + ' · ' + short(S.wallet); refresh(); } }).catch(() => {});
})();
