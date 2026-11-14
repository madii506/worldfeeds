/* $WORLD — the site. A live ASCII globe lit by the real sun, a world map of live GDACS alerts with day, night and
   mealtime, a fee calculator for the coin's own Raydium launchpad (1% to the kitchen), and a ledger read straight from
   Solana. No numbers on this page are invented. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = { ink: '#151513', ink2: '#4c4a44', mute: '#8b877c', o: '#ff5a1f', o2: '#e4460c', g: '#159a52', b: '#2f7fd0', red: '#d0372a', paper: '#f6f3ec', card: '#fbf9f4' };
  const LV = { red: C.red, orange: C.o, green: C.g }, LW = { red: 3, orange: 2, green: 1 };
  const GLYPH = { EQ: '*', FL: '~', TC: '@', WF: '^', DR: '%', VO: 'A', TS: '~' }, TNAME = { EQ: 'earthquakes', FL: 'floods', TC: 'cyclones', WF: 'wildfires', DR: 'droughts', VO: 'volcanoes', TS: 'tsunamis' };
  const RAMP = ' .:-=+*#%@', DUST = '01<>/\\|=+*#%.:';
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p, eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, eout = p => 1 - Math.pow(1 - p, 3);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1800); };
  const say = m => { $('#live').textContent = m; };
  const usd = v => v == null || !isFinite(v) ? '—' : '$' + (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(v >= .01 ? 3 : 4));
  const trim = s => s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, '');
  const sol = v => v == null || !isFinite(v) ? '—' : (v >= 100 ? v.toFixed(2) : v >= 1 ? trim(v.toFixed(4)) : trim(v.toFixed(6))) + ' SOL';
  const tms = t => { if (!t) return NaN; if (typeof t === 'number') return t; return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : t + 'Z').getTime(); };
  const ago = t => { const v = tms(t); if (!isFinite(v)) return ''; const s = Math.max(0, (Date.now() - v) / 1000); return s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago'; };
  const dm = t => new Date(tms(t)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const when = e => { const a = tms(e.from), b = tms(e.to); return isFinite(a) && isFinite(b) && b - a > 864e5 ? `since ${dm(a)} · updated ${ago(b)}` : ago(e.from); };
  const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
  const jget = async (u, ms = 12000) => { const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms); try { const r = await fetch(u, { signal: ac.signal, cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(t); } };

  // ---------------------------------------------------------------- the land mask (0.5° equirectangular bitmap)
  const LM = (() => { const L = window.LAND; if (!L) return null; const bin = atob(L.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return { w: L.w, h: L.h, u }; })();
  const isLand = (lat, lon) => { if (!LM) return false; let x = Math.floor((lon + 180) / 360 * LM.w); x = ((x % LM.w) + LM.w) % LM.w; const y = clamp(Math.floor((90 - lat) / 180 * LM.h), 0, LM.h - 1), i = y * LM.w + x; return (LM.u[i >> 3] >> (i & 7)) & 1; };

  // ---------------------------------------------------------------- the real sun: where it is overhead right now
  // declination and the equation of time (NOAA's short form); good to a fraction of a degree, which is a glyph.
  const SUN = (d = new Date()) => { const N = (d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5, B = 2 * Math.PI * (N - 81) / 364;
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B), dec = 23.44 * Math.sin(2 * Math.PI * (284 + N) / 365);
    const m = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60; let lon = -(m - 720 + eot) / 4; lon = ((lon + 540) % 360 + 360) % 360 - 180; return { lat: dec, lon }; };
  const RAD = Math.PI / 180;
  const sunAlt = (lat, lon, s) => Math.sin(lat * RAD) * Math.sin(s.lat * RAD) + Math.cos(lat * RAD) * Math.cos(s.lat * RAD) * Math.cos((lon - s.lon) * RAD);
  // on paper, night has to be darker ink rather than fainter ink, or it reads as brighter
  const NIGHT_LAND = '#1d4a33', NIGHT_SEA = '#2c3440';
  const lookAt = (lat, lon, nz, sun) => { const e = sunAlt(lat, lon, sun), limb = .55 + .45 * Math.pow(nz, .6);
    if (Math.abs(e + .01) < .03) return isLand(lat, lon) ? ['+', C.o2, .95] : [':', C.o, .85];
    if (e > 0) { const lit = limb * (.62 + .38 * clamp(e * 2.2, 0, 1)); return isLand(lat, lon) ? [RAMP[5 + Math.round(lit * 3)], C.g, .42 + .58 * lit] : [lit > .66 ? ':' : '.', C.b, .3 + .55 * lit]; }
    return isLand(lat, lon) ? [limb > .8 ? '=' : '-', NIGHT_LAND, .5 + .35 * limb] : ['.', NIGHT_SEA, .26 + .3 * limb]; };

  // ---------------------------------------------------------------- the ground: a dotted sea that drifts
  (() => { const cv = $('#ground'), x = cv.getContext('2d'); let W, H, dpr, last = 0, mx = -999, my = -999, pm = 0; const S = 24, rings = [];
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; draw(0); };
    function draw(ts) { x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H); const ox = (ts / 260) % S, oy = (ts / 520) % S, now = performance.now();
      for (let k = rings.length - 1; k >= 0; k--) if (now - rings[k].t > 1700) rings.splice(k, 1);
      pm += ((now - mvT < 1200 ? 1 : 0) - pm) * .12;
      for (let yy = -S + oy; yy < H + S; yy += S) for (let xx = -S + ox + ((Math.round((yy - oy) / S) & 1) ? S / 2 : 0); xx < W + S; xx += S) {
        let px = xx, py = yy, hot = 0; const w = .55 + .45 * Math.sin(xx * .011 + ts / 3200) * Math.cos(yy * .013 - ts / 4100);
        if (pm > .02) { const dx = xx - mx, dy = yy - my, d = Math.hypot(dx, dy); if (d < 150 && d > .1) { const f = Math.pow(1 - d / 150, 2) * pm; px += dx / d * f * 16; py += dy / d * f * 16; hot = Math.max(hot, f); } }
        for (const r of rings) { const rr = (now - r.t) * .55, dx = xx - r.x, dy = yy - r.y, d = Math.hypot(dx, dy), band = 1 - Math.abs(d - rr) / 26; if (band > 0 && d > .1) { const f = band * (1 - (now - r.t) / 1700); px += dx / d * f * 10; py += dy / d * f * 10; hot = Math.max(hot, f); } }
        if (hot > .05) { x.globalAlpha = .35 + .65 * hot; x.fillStyle = C.o; x.fillRect(px - .5, py - .5, 2.6, 2.6); }
        else { x.globalAlpha = (.35 + .65 * w) * .13 / .13; x.fillStyle = 'rgba(47,127,208,.13)'; x.fillRect(px, py, 1.6, 1.6); } }
      x.globalAlpha = 1; }
    let mvT = -1e9; const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine) addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; mvT = performance.now(); }, { passive: true });
    addEventListener('pointerdown', e => { if (e.target.closest('input,button,a,.globe,.map,.seis')) return; rings.push({ x: e.clientX, y: e.clientY, t: performance.now() }); if (rings.length > 5) rings.shift(); }, { passive: true });
    const loop = ts => { requestAnimationFrame(loop); if (document.hidden || ts - last < 33) return; last = ts; draw(ts); };
    addEventListener('resize', size); size(); if (!RM) requestAnimationFrame(loop); })();

  // ---------------------------------------------------------------- the clock
  const tickClock = () => { const d = new Date(); $('#clock').innerHTML = 'UTC <b>' + d.toISOString().slice(11, 19) + '</b>'; };
  tickClock(); setInterval(tickClock, 1000);

  // ---------------------------------------------------------------- state
  const S = { cfg: null, solUsd: null, events: [], planet: null, filter: 'all', showAll: false, hl: null, sunT: null, card: null };
  const sunNow = () => SUN(S.sunT ? new Date(S.sunT) : new Date());

  // ---------------------------------------------------------------- mealtime: real local time in 48 cities
  const CITIES = [['Lagos', 'Africa/Lagos', 6.52, 3.38], ['Port-au-Prince', 'America/Port-au-Prince', 18.54, -72.34], ['Manila', 'Asia/Manila', 14.6, 120.98], ['Lima', 'America/Lima', -12.05, -77.04], ['Nairobi', 'Africa/Nairobi', -1.29, 36.82],
    ['Kyiv', 'Europe/Kyiv', 50.45, 30.52], ['Dhaka', 'Asia/Dhaka', 23.81, 90.41], ['Mexico City', 'America/Mexico_City', 19.43, -99.13], ['Istanbul', 'Europe/Istanbul', 41.01, 28.98], ['Jakarta', 'Asia/Jakarta', -6.2, 106.85],
    ['São Paulo', 'America/Sao_Paulo', -23.55, -46.63], ['Cairo', 'Africa/Cairo', 30.04, 31.24], ['Karachi', 'Asia/Karachi', 24.86, 67], ['New Orleans', 'America/Chicago', 29.95, -90.07], ['Kinshasa', 'Africa/Kinshasa', -4.44, 15.27],
    ['Tokyo', 'Asia/Tokyo', 35.68, 139.69], ['Bogotá', 'America/Bogota', 4.71, -74.07], ['Addis Ababa', 'Africa/Addis_Ababa', 9.03, 38.74], ['Delhi', 'Asia/Kolkata', 28.61, 77.21], ['Los Angeles', 'America/Los_Angeles', 34.05, -118.24],
    ['Johannesburg', 'Africa/Johannesburg', -26.2, 28.05], ['Bangkok', 'Asia/Bangkok', 13.76, 100.5], ['Madrid', 'Europe/Madrid', 40.42, -3.7], ['Santiago', 'America/Santiago', -33.45, -70.67], ['Khartoum', 'Africa/Khartoum', 15.5, 32.56],
    ['Kathmandu', 'Asia/Kathmandu', 27.72, 85.32], ['Antananarivo', 'Indian/Antananarivo', -18.88, 47.51], ['New York', 'America/New_York', 40.71, -74.01], ['Tehran', 'Asia/Tehran', 35.69, 51.39], ['Accra', 'Africa/Accra', 5.6, -.19],
    ['Sydney', 'Australia/Sydney', -33.87, 151.21], ['San Juan', 'America/Puerto_Rico', 18.47, -66.11], ['Beirut', 'Asia/Beirut', 33.89, 35.5], ['Dakar', 'Africa/Dakar', 14.72, -17.47], ['Yangon', 'Asia/Yangon', 16.84, 96.17],
    ['Guatemala City', 'America/Guatemala', 14.63, -90.51], ['Kabul', 'Asia/Kabul', 34.56, 69.21], ['London', 'Europe/London', 51.51, -.13], ['Tegucigalpa', 'America/Tegucigalpa', 14.07, -87.19], ['Hanoi', 'Asia/Ho_Chi_Minh', 21.03, 105.85],
    ['Maputo', 'Africa/Maputo', -25.97, 32.57], ['Honolulu', 'Pacific/Honolulu', 21.31, -157.86], ['Lahore', 'Asia/Karachi', 31.55, 74.34], ['Rome', 'Europe/Rome', 41.9, 12.5], ['Caracas', 'America/Caracas', 10.48, -66.9],
    ['Auckland', 'Pacific/Auckland', -36.85, 174.76], ['Kampala', 'Africa/Kampala', .35, 32.58], ['Seoul', 'Asia/Seoul', 37.57, 126.98]];
  const fmts = {}; const local = tz => { try { const f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })); return f.format(new Date()).replace(/^24/, '00'); } catch { return null; } };
  const meal = hm => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number), v = h + m / 60; return v >= 6.5 && v < 9 ? 'breakfast' : v >= 12 && v < 14 ? 'lunch' : v >= 18 && v < 21 ? 'dinner' : ''; };
  let MEALS = [];
  function tape() { MEALS = CITIES.map(([n, tz, lat, lon]) => { const t = local(tz); return { n, t, m: meal(t), lat, lon }; }).filter(i => i.t); const mealN = MEALS.filter(i => i.m).length;
    $('#mealN').textContent = `${mealN} of ${MEALS.length}`; countTo($('#pMeal'), mealN);
    const html = MEALS.map(i => `<span class="${i.m ? 'meal' : ''}"><b>${esc(i.n.toUpperCase())}</b> ${i.t}${i.m ? ` <em>${i.m}</em>` : ''}</span>`).join('');
    $('#tape').innerHTML = html + html; if (window.M) M.repaint(); }

  // count-ups that wait until the number is on screen
  const cio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.dataset.seen = 1; const v = e.target.dataset.to; if (v != null) runCount(e.target, +v); cio.unobserve(e.target); } }), { threshold: .4 });
  function runCount(el, n) { const from = +(el.dataset.at || 0); el.dataset.at = n; if (RM || from === n) { el.textContent = n.toLocaleString('en-US'); return; }
    const t0 = performance.now(), d = 1100; const f = now => { const p = clamp((now - t0) / d, 0, 1); el.textContent = Math.round(lerp(from, n, eout(p))).toLocaleString('en-US'); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); setTimeout(() => { el.textContent = n.toLocaleString('en-US'); }, d + 200); }
  function countTo(el, n) { if (!el) return; el.dataset.to = n; if (el.dataset.seen) runCount(el, n); else cio.observe(el); }

  // ---------------------------------------------------------------- the globe
  const G = (() => {
    const box = $('#globe'), cv = $('#globeCv'), x = cv.getContext('2d'), tip = $('#gtip');
    const s0 = SUN(); let size, dpr, R, cx, cy, cols, fs, cw, ch, cells = [], lon0 = s0.lon + 55, lat0 = 16, vlon = 0, vlat = 0, drag = null, lastInput = -1e9, t0 = performance.now(), last = 0, markers = [], held = false, ready;
    const done = new Promise(r => { ready = r; });
    function layout() { dpr = Math.min(2, devicePixelRatio || 1); size = box.clientWidth; if (!size) return; cv.width = size * dpr; cv.height = size * dpr; R = size * .455; cx = size / 2; cy = size / 2;
      cols = size > 470 ? 96 : 70; cw = 2 * R / cols; fs = cw / .6; ch = fs * 1.18; cells = [];
      const c0 = Math.floor((cx - R * 1.06) / cw), c1 = Math.ceil((cx + R * 1.06) / cw), r0 = Math.floor((cy - R * 1.06) / ch), r1 = Math.ceil((cy + R * 1.06) / ch);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const px = (c + .5) * cw, py = (r + .5) * ch, nx = (px - cx) / R, ny = -(py - cy) / R, q = nx * nx + ny * ny; if (q > 1.1) continue;
        const rim = q > 1, nz = rim ? 0 : Math.sqrt(1 - q); cells.push({ c, r, gx: c * cw, gy: r * ch + ch * .78, nx, ny, nz, rim, d: Math.sqrt(q), h: hash(c + 99, r + 7) }); } }
    const toWorld = (nx, ny, nz) => { const a = -lat0 * RAD, b = lon0 * RAD; const y1 = ny * Math.cos(a) - nz * Math.sin(a), z1 = ny * Math.sin(a) + nz * Math.cos(a), x2 = nx * Math.cos(b) + z1 * Math.sin(b), z2 = -nx * Math.sin(b) + z1 * Math.cos(b);
      return [Math.asin(clamp(y1, -1, 1)) / RAD, Math.atan2(x2, z2) / RAD]; };
    const toView = (lat, lon) => { const la = lat * RAD, lo = lon * RAD, wx = Math.cos(la) * Math.sin(lo), wy = Math.sin(la), wz = Math.cos(la) * Math.cos(lo), b = -lon0 * RAD, a = lat0 * RAD;
      const x1 = wx * Math.cos(b) + wz * Math.sin(b), z1 = -wx * Math.sin(b) + wz * Math.cos(b), y2 = wy * Math.cos(a) - z1 * Math.sin(a), z2 = wy * Math.sin(a) + z1 * Math.cos(a); return [x1, y2, z2]; };
    // what one cell looks like: lit by the real sun, darker at the limb, the sunrise and sunset line in orange
    function look(k, sun) {
      if (k.rim) return k.d < 1.045 ? [k.d < 1.02 ? ':' : '.', C.b, .55] : null;
      const [lat, lon] = toWorld(k.nx, k.ny, k.nz); return lookAt(lat, lon, k.nz, sun); }
    function drawMarkers(ctx, now, T, alphaOf) { // T maps globe space to the context; alphaOf(i) fades markers in during the intro
      const out = []; let i = 0;
      for (const e of S.events) { const [vx, vy, vz] = toView(e.lat, e.lon); if (vz < .12) continue; const c = Math.floor((cx + vx * R) / cw), r = Math.floor((cy - vy * R) / ch), px = (c + .5) * cw, py = (r + .5) * ch;
        const a = alphaOf ? alphaOf(i++, e) : 1; if (a <= 0) continue; out.push({ e, px, py }); const hl = S.hl === e.id, [X, Y] = T(px, py), k = T.k;
        ctx.globalAlpha = a; ctx.fillStyle = C.paper; ctx.fillRect(X - cw * .6 * k - cw * .5 * k, Y - ch * .65 * k, cw * 2.2 * k, ch * 1.3 * k);
        if (e.level !== 'green' || hl) { const p = ((now / 1600) + hash(c, r)) % 1; ctx.globalAlpha = (1 - p) * (hl ? .9 : .6) * a; ctx.strokeStyle = LV[e.level]; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(X, Y, (4 + p * (hl ? 22 : 15)) * k, 0, 6.283); ctx.stroke(); }
        ctx.globalAlpha = a; ctx.fillStyle = LV[e.level] || C.o; ctx.font = `800 ${fs * 1.55 * k}px JB, ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.fillText(GLYPH[e.code] || '*', X, Y + fs * .5 * k); ctx.textAlign = 'left'; }
      ctx.globalAlpha = 1; return out; }
    function frame(now) {
      const t = now - t0, sun = sunNow(); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, size, size); x.textBaseline = 'alphabetic';
      const f = `600 ${fs}px JB, ui-monospace, monospace`; x.font = f;
      for (const k of cells) { const rv = 120 + k.d * 820 + k.h * 260; if (!RM && t < rv) continue;
        if (!RM && t < rv + 160) { x.globalAlpha = .45; x.fillStyle = C.g; x.fillText(DUST[Math.floor(hash(k.c, k.r + Math.floor(t / 45)) * 14)], k.gx, k.gy); continue; }
        const L = look(k, sun); if (!L) continue; x.globalAlpha = L[2]; x.fillStyle = L[1]; x.fillText(L[0], k.gx, k.gy); }
      const I = (a, b) => [a, b]; I.k = 1; markers = (t > 900 || RM) ? drawMarkers(x, now, I) : []; x.font = f; x.globalAlpha = 1; }
    let sy = scrollY; addEventListener('scroll', () => { const d = scrollY - sy; sy = scrollY; if (!held && !drag && !RM) { vlon -= d * .012; vlon = clamp(vlon, -2.4, 2.4); } const k = clamp(scrollY / innerHeight, 0, 1); box.style.transform = RM ? '' : `translate3d(0,${(k * 70).toFixed(1)}px,0) scale(${(1 - k * .12).toFixed(3)})`; }, { passive: true });
    function loop(now) { requestAnimationFrame(loop); if (held || document.hidden || !size) return; if (now - last < 33) return; const dt = Math.min(80, now - (last || now)); last = now;
      if (!drag) { if (now - lastInput > 1800 && !RM) vlon += (-.0062 * dt - vlon) * .04; lon0 += vlon; lat0 = clamp(lat0 + vlat, -60, 70); vlat *= .9; if (now - lastInput > 1800) lat0 += (16 - lat0) * .01; }
      frame(now); }
    box.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, lon0, lat0, t: performance.now() }; box.setPointerCapture(e.pointerId); vlon = 0; vlat = 0; lastInput = performance.now(); tip.classList.remove('on'); });
    box.addEventListener('pointermove', e => { const rc = box.getBoundingClientRect();
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y, k = 180 / (R * Math.PI) * .95; const nl = drag.lon0 - dx * k, nt = clamp(drag.lat0 + dy * k, -60, 70); vlon = (nl - lon0) * .5; vlat = 0; lon0 = nl; lat0 = nt; lastInput = performance.now(); return; }
      const sc = rc.width ? size / rc.width : 1, mx = (e.clientX - rc.left) * sc, my = (e.clientY - rc.top) * sc; let best = null, bd = 16; for (const m of markers) { const d = Math.hypot(m.px - mx, m.py - my); if (d < bd) { bd = d; best = m; } }
      if (best) { tip.innerHTML = `<b>${esc(best.e.name)}</b><br>${esc(best.e.level)} alert · ${esc(when(best.e))}`; tip.style.left = best.px + 'px'; tip.style.top = best.py + 'px'; tip.classList.add('on'); box.style.cursor = 'pointer'; G.hover = best.e; }
      else { tip.classList.remove('on'); box.style.cursor = ''; G.hover = null; } });
    const end = e => { if (!drag) return; const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y); drag = null; lastInput = performance.now(); if (moved < 4 && G.hover && G.hover.url) window.open(G.hover.url, '_blank', 'noopener'); };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', () => { drag = null; }); box.addEventListener('pointerleave', () => tip.classList.remove('on'));
    new ResizeObserver(() => { layout(); if (size) frame(performance.now()); }).observe(box);
    const go = () => { layout(); t0 = performance.now(); requestAnimationFrame(loop); ready(); };
    Promise.race([document.fonts.load('600 12px JB'), new Promise(r => setTimeout(r, 1500))]).finally(go);
    return { hover: null, done, look, drawMarkers, toWorld, toView,
      geo: () => ({ size, R, cw, ch, fs, cells }), get lon0() { return lon0; }, get lat0() { return lat0; },
      set: (lo, la) => { lon0 = lo; if (la != null) lat0 = la; }, hold: (v, decode) => { held = v; if (!v) { t0 = performance.now() - (decode ? 0 : 5000); last = 0; } }, frame: () => frame(performance.now()) };
  })();

  // ---------------------------------------------------------------- the intro, no words: a night sky, the stars stream in and become the
  // night side of the Earth with its city lights, the sun rises over the limb, day sweeps across, the sky dawns, the globe settles into the page.
  const INTRO = document.documentElement.classList.contains('intro');
  function introRun() {
    const el = $('#intro'), cv = $('#introCv'), x = cv.getContext('2d'), bar = $('#introBar'), html = document.documentElement;
    let vw, vh, dpr, T0 = performance.now(), ended = false, handed = false, skipAt = null, released = false; el.classList.add('run');
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); vw = innerWidth; vh = innerHeight; cv.width = vw * dpr; cv.height = vh * dpr; };
    size();
    const geo = G.geo(), cells = geo.cells; if (!geo.size || !cells.length) { finish(); return; }
    const lonEnd = G.lon0, latEnd = G.lat0, lonStart = lonEnd + 150, latStart = latEnd - 18;
    const parts = cells.map(k => ({ k, sx: hash(k.c * 3 + 1, k.r * 7 + 2) * vw, sy: hash(k.c * 5 + 3, k.r * 11 + 5) * vh, go: 500 + k.d * 820 + k.h * 420, tw: hash(k.c + 17, k.r + 31) }));
    const final = () => { const r = $('#globe').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, k: 1 }; };
    const big = { x: vw / 2, y: vh / 2, k: clamp(Math.min(vw, vh * 1.05) * .7 / geo.size, .9, 1.85) };
    const HAND = 4300, HLEN = 1050, END = HAND + HLEN, SWEEP0 = 2050, SWEEP = 1500;
    // night palette: on an ink sky the same glyphs need lighter inks
    const DARK = { [C.g]: '#4fd18d', [NIGHT_LAND]: '#2f8f5f', [C.b]: '#7fb2f0', [NIGHT_SEA]: '#5a6b82', [C.o2]: '#ff7f4d', [C.o]: '#ff7a45', [C.red]: '#ff6a5a', [C.ink2]: '#bdb6a8' };
    const mix = (a, b, p) => { const A = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), B = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16)); return A.map((v, i) => Math.round(v + (B[i] - v) * p)); };
    const skip = () => { if (ended || skipAt != null) return; const t = performance.now() - T0; if (t < HAND) { skipAt = t; T0 -= (HAND - t); } };
    ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, skip, { passive: true, once: true }));
    G.hold(true);
    function frame(now) {
      if (ended) return; const t = now - T0; requestAnimationFrame(frame);
      const rot = eout(clamp((t - 250) / 3750, 0, 1)); G.set(lerp(lonStart, lonEnd, rot), lerp(latStart, latEnd, rot));
      // the sun comes up: a day of light sweeps the globe, then the sky dawns from ink to paper
      const sw = clamp((t - SWEEP0) / SWEEP, 0, 1), swe = eio(sw); S.sunT = sw < 1 ? Date.now() - (1 - swe) * 13 * 3600e3 : null; const sun = sunNow();
      const dk = false;
      const hp = eio(clamp((t - HAND) / HLEN, 0, 1)), F = hp > 0 ? final() : big, zoom = lerp(.9, 1, eout(clamp(t / 2600, 0, 1))), P = { x: lerp(big.x, F.x, hp), y: lerp(big.y, F.y, hp), k: lerp(big.k * zoom, F.k, hp) };
      if (hp > 0 && !handed) { handed = true; html.classList.remove('intro'); $('.hero').classList.add('go'); if (vw < 700) { released = true; G.hold(false, true); } }
      const am = released ? 1 - hp : 1, ink = c => dk ? (DARK[c] || c) : c;
      const T = (gx, gy) => [P.x + (gx - geo.size / 2) * P.k, P.y + (gy - geo.size / 2) * P.k]; T.k = P.k;
      const sky = [246, 243, 236];
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, vw, vh); el.style.backgroundColor = `rgba(${sky[0]},${sky[1]},${sky[2]},${1 - hp})`;
      x.textBaseline = 'alphabetic'; const fA = `600 ${geo.fs * P.k}px JB, ui-monospace, monospace`; const fade = clamp(t / 500, 0, 1);
      // the orbit ring and its satellite: back half behind the Earth, front half over it
      const ra = clamp((t - 1300) / 700, 0, 1) * (1 - clamp((t - HAND + 200) / 500, 0, 1)), rr = geo.R * 1.32 * P.k, tilt = -.32, ph = t / 2600;
      const ring = front => { if (ra <= 0) return; x.font = `600 ${geo.fs * P.k * 1.1}px JB, ui-monospace, monospace`; for (let i = 0; i < 120; i++) { const a = i / 120 * 6.283 + ph, sz = Math.sin(a); if ((sz > 0) !== front) continue;
          const ex = Math.cos(a) * rr, ey = sz * rr * .24, X = P.x + ex * Math.cos(tilt) - ey * Math.sin(tilt), Y = P.y + ex * Math.sin(tilt) + ey * Math.cos(tilt); x.globalAlpha = ra * (front ? .75 : .22) * am; x.fillStyle = ink(C.b); x.fillText(i % 6 ? '.' : ':', X, Y); }
        const a = ph * 2.4 * 6.283, sz = Math.sin(a); if ((sz > 0) === front) { const ex = Math.cos(a) * rr, ey = sz * rr * .24, X = P.x + ex * Math.cos(tilt) - ey * Math.sin(tilt), Y = P.y + ex * Math.sin(tilt) + ey * Math.cos(tilt);
          x.globalAlpha = ra * (front ? 1 : .35) * am; x.fillStyle = C.o; x.beginPath(); x.arc(X, Y - geo.fs * P.k * .3, 3.6 * P.k, 0, 6.283); x.fill(); } };
      ring(false);
      // the sun itself, rising over the limb in its real direction
      { const [sx, sy, sz] = G.toView(sun.lat, sun.lon), n = Math.hypot(sx, sy) || 1, sa = clamp((sz + .35) / .35, 0, 1) * clamp(1 - (t - HAND + 300) / 600, 0, 1) * clamp((t - SWEEP0 + 300) / 500, 0, 1);
        if (sa > 0) { const R = geo.R * P.k, d = R * (1.16 + .18 * clamp(sz + .3, 0, 1)), X = P.x + sx / n * d, Y = P.y - sy / n * d, rad = 9 * P.k + 4;
          x.globalAlpha = sa * .9; x.fillStyle = C.o; x.beginPath(); x.arc(X, Y, rad, 0, 6.283); x.fill();
          x.font = `800 ${geo.fs * P.k * 1.2}px JB, ui-monospace, monospace`; x.textAlign = 'center';
          for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + t / 1800, rr2 = rad + 8 + ((t / 260 + i) % 3) * 5; x.globalAlpha = sa * (.35 + .4 * ((i + Math.floor(t / 120)) % 2)); x.fillText(i % 2 ? '*' : '+', X + Math.cos(a) * rr2, Y + Math.sin(a) * rr2 + 4); } x.textAlign = 'left'; } }
      x.font = fA;
      for (const p of parts) { const k = p.k, [tx, ty] = T(k.gx, k.gy), fp = clamp((t - p.go) / 760, 0, 1);
        if (fp < 1) { const e = eio(fp), px = lerp(p.sx + Math.sin(t / 900 + k.h * 9) * 5, tx, e), py = lerp(p.sy + Math.cos(t / 1000 + k.h * 7) * 5, ty, e);
          if (e < .02) { const tw = .25 + .75 * Math.abs(Math.sin(t / (300 + p.tw * 500) + p.tw * 20)); x.globalAlpha = tw * fade * (p.tw > .9 ? .95 : .55); x.fillStyle = p.tw > .93 ? C.o : p.tw > .6 ? C.b : C.g; x.fillText(p.tw > .9 ? '*' : p.tw > .6 ? '+' : '.', px, py); continue; }
          x.globalAlpha = (.4 + .5 * e) * fade; x.fillStyle = ink(k.h > .86 ? C.o : k.h > .45 ? C.b : C.g); x.fillText(DUST[Math.floor(hash(k.c, k.r + Math.floor(t / 60)) * 14)], px, py); continue; }
        const L = G.look(k, sun); if (!L) continue; const fl = t - p.go - 760;
        if (fl < 240) { x.globalAlpha = (1 - fl / 480) * am; x.fillStyle = C.o; x.fillText(L[0] === '.' ? ':' : L[0], tx, ty); continue; }
        x.globalAlpha = L[2] * am * (dk ? 1.15 : 1); x.fillStyle = ink(L[1]); x.fillText(L[0], tx, ty); }
      // city lights: the 48 tape cities glow on the night side until the sun reaches them
      if (t > 1500) { const ca = clamp((t - 1500) / 500, 0, 1) * (1 - hp); for (const m of MEALS) { const [vx, vy, vz] = G.toView(m.lat, m.lon); if (vz < .1 || sunAlt(m.lat, m.lon, sun) > -.02) continue;
          const [X, Y] = T(geo.size / 2 + vx * geo.R, geo.size / 2 - vy * geo.R), tw = .6 + .4 * Math.sin(t / 240 + m.lat); x.globalAlpha = ca * tw * am; x.fillStyle = C.o; x.beginPath(); x.arc(X, Y, 1.9 * P.k + .6, 0, 6.283); x.fill(); x.globalAlpha = ca * tw * .25 * am; x.beginPath(); x.arc(X, Y, 5 * P.k, 0, 6.283); x.fill(); } }
      ring(true);
      if (t > 3300) G.drawMarkers(x, now, T, (i, e) => clamp((t - 3300 - (LW[e.level] > 1 ? 0 : 220) - i * 8) / 260, 0, 1) * am);
      x.globalAlpha = 1; bar.style.width = (clamp(t / END, 0, 1) * 100) + '%'; bar.style.opacity = 1 - hp;
      if (t >= END) finish(); }
    function finish() { if (ended) return; ended = true; S.sunT = null; html.classList.remove('intro'); $('.hero').classList.add('go'); if (!released) { G.hold(false); G.frame(); } if (el) el.remove(); }
    setTimeout(finish, 11000); requestAnimationFrame(frame);
    addEventListener('resize', () => { if (!ended) finish(); }, { once: true });
  }

  // ---------------------------------------------------------------- the flat world map (section 04)
  const M = window.M = (() => {
    const wrap = $('#map'), box = $('#mapIn'), cv = $('#mapCv'), x = cv.getContext('2d'), tip = $('#mtip'), base = document.createElement('canvas'), bx = base.getContext('2d');
    const LAT0 = 78, LAT1 = -57; let W, H, dpr, cols, rows, cw, ch, fs, pts = [], last = 0, sun = SUN(), centred = false;
    function layout() { dpr = Math.min(2, devicePixelRatio || 1); W = box.clientWidth; if (!W) return; cols = clamp(Math.round(W / 5.6), 96, 290); cw = W / cols; fs = cw / .6; ch = fs * 1.18; H = Math.round(Math.max(240, W * (LAT0 - LAT1) / 360 * .98)); rows = Math.floor(H / ch);
      cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px'; base.width = cv.width; base.height = cv.height; paintBase();
      if (!centred && wrap.scrollWidth > wrap.clientWidth + 4) { centred = true; wrap.scrollLeft = (25 + 180) / 360 * W - wrap.clientWidth / 2; } }
    const lonOf = c => -180 + (c + .5) / cols * 360, latOf = r => LAT0 - (r + .5) / rows * (LAT0 - LAT1), colOf = lon => Math.floor((lon + 180) / 360 * cols), rowOf = lat => Math.floor((LAT0 - lat) / (LAT0 - LAT1) * rows);
    function paintBase() { if (!W) return; sun = SUN(); bx.setTransform(dpr, 0, 0, dpr, 0, 0); bx.clearRect(0, 0, W, H); bx.textBaseline = 'alphabetic'; bx.font = `600 ${fs}px JB, ui-monospace, monospace`;
      const land = []; for (let r = 0; r < rows; r++) { land.push([]); for (let c = 0; c < cols; c++) land[r].push(isLand(latOf(r), lonOf(c))); }
      const at = (r, c) => r >= 0 && r < rows && land[r][(c + cols) % cols];
      const eqR = Math.round((LAT0 - 0) / (LAT0 - LAT1) * rows - .5);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const gx = c * cw, gy = r * ch + ch * .78, e = sunAlt(latOf(r), lonOf(c), sun), night = e < -.035, dusk = !night && e < .03;
        if (land[r][c]) { const coast = !at(r - 1, c) || !at(r + 1, c) || !at(r, c - 1) || !at(r, c + 1); bx.globalAlpha = coast ? .95 : night ? .86 : .62; bx.fillStyle = dusk ? C.o2 : coast ? '#3f3d37' : night ? '#5e5a51' : '#8f8a7d'; bx.fillText('#', gx, gy); }
        else if (dusk) { bx.globalAlpha = .8; bx.fillStyle = C.o; bx.fillText(':', gx, gy); }
        else if (night) { if ((r + c) % 2 === 0) { bx.globalAlpha = .42; bx.fillStyle = NIGHT_SEA; bx.fillText('.', gx, gy); } }
        else if (r === eqR) { if (c % 2 === 0) { bx.globalAlpha = .55; bx.fillStyle = C.b; bx.fillText('-', gx, gy); } }
        else if (r % 2 === 0 && c % 2 === 0) { bx.globalAlpha = .4; bx.fillStyle = C.b; bx.fillText('.', gx, gy); } }
      bx.globalAlpha = 1; draw(performance.now()); }
    function draw(now) { if (!W) return; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(base, 0, 0); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.textBaseline = 'alphabetic';
      pts = []; const list = visible();
      // the sun, where it is overhead right now
      { const c = colOf(sun.lon), r = rowOf(sun.lat), px = (c + .5) * cw, py = (r + .5) * ch, p = (now / 2600) % 1;
        x.globalAlpha = 1; x.fillStyle = C.card; x.beginPath(); x.arc(px, py, 9, 0, 6.283); x.fill(); x.fillStyle = C.o; x.beginPath(); x.arc(px, py, 5, 0, 6.283); x.fill();
        x.strokeStyle = C.o; x.lineWidth = 1.2; x.globalAlpha = .9; x.beginPath(); x.arc(px, py, 8.5, 0, 6.283); x.stroke(); x.globalAlpha = (1 - p) * .5; x.beginPath(); x.arc(px, py, 9 + p * 26, 0, 6.283); x.stroke();
        pts.push({ sun: true, px, py }); }
      // the 48 tape cities: a cross, or an orange square at mealtime with its name
      const labels = [];
      for (const m of MEALS) { const c = colOf(m.lon), r = rowOf(m.lat); if (r < 0 || r >= rows) continue; const px = (c + .5) * cw, py = (r + .5) * ch; pts.push({ city: m, px, py });
        if (m.m) { x.globalAlpha = 1; x.fillStyle = C.card; x.fillRect(px - 5, py - 5, 10, 10); x.fillStyle = C.o; x.fillRect(px - 3.5, py - 3.5, 7, 7); if (W > 700) labels.push({ m, px, py }); }
        else { x.globalAlpha = .75; x.strokeStyle = C.ink; x.lineWidth = 1.1; x.beginPath(); x.moveTo(px - 3, py); x.lineTo(px + 3, py); x.moveTo(px, py - 3); x.lineTo(px, py + 3); x.stroke(); } }
      for (const e of list) { const c = colOf(e.lon), r = rowOf(e.lat); if (r < 0 || r >= rows) continue; const px = (c + .5) * cw, py = (r + .5) * ch, hl = S.hl === e.id;
        pts.push({ e, px, py });
        if (e.level !== 'green' || hl) { const p = ((now / 1700) + hash(c, r)) % 1; x.globalAlpha = (1 - p) * (hl ? .95 : .6); x.strokeStyle = LV[e.level]; x.lineWidth = hl ? 1.8 : 1.2; x.beginPath(); x.arc(px, py, 5 + p * (hl ? 30 : 20), 0, 6.283); x.stroke(); } }
      if (!RM) { const sx = ((now / 7000) % 1) * W; x.globalAlpha = .55; x.fillStyle = C.o; x.fillRect(Math.round(sx), 0, 1, H); x.globalAlpha = .18; x.fillRect(Math.round(sx) - 3, 0, 3, H);
        for (const p of pts) if (p.e && sx - p.px > 0 && sx - p.px < 60) { const q = (sx - p.px) / 60; x.globalAlpha = (1 - q) * .8; x.strokeStyle = LV[p.e.level]; x.lineWidth = 1.3; x.beginPath(); x.arc(p.px, p.py, 4 + q * 16, 0, 6.283); x.stroke(); } x.globalAlpha = 1; }
      for (const p of pts) { if (!p.e) continue; const hl = S.hl === p.e.id; x.globalAlpha = 1; x.fillStyle = C.card; x.fillRect(p.px - cw * .9, p.py - ch * .5, cw * 1.8, ch); x.fillStyle = LV[p.e.level] || C.o; x.font = `800 ${fs * (hl ? 1.7 : 1.3)}px JB, ui-monospace, monospace`; x.textAlign = 'center'; x.fillText(GLYPH[p.e.code] || '*', p.px, p.py + fs * (hl ? .55 : .42)); }
      x.textAlign = 'left'; x.globalAlpha = 1; x.font = `500 ${W > 900 ? 10.5 : 9.5}px DMM, ui-monospace, monospace`; const placed = [];
      for (const l of labels) { const t = l.m.n.toLowerCase(), tw = x.measureText(t).width, lx = l.px + tw + 20 > W ? l.px - tw - 19 : l.px + 7;
        if (placed.some(q => lx < q[0] + q[2] + 6 && q[0] < lx + tw + 14 && Math.abs(q[1] - l.py) < 14)) continue; placed.push([lx, l.py, tw + 8]);
        x.fillStyle = 'rgba(251,249,244,.94)'; x.fillRect(lx, l.py - 7, tw + 8, 14); x.fillStyle = C.o2; x.fillText(t, lx + 4, l.py + 3.5); }
      x.globalAlpha = 1; }
    function loop(now) { requestAnimationFrame(loop); if (document.hidden || now - last < 50) return; const r = wrap.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; last = now; draw(now); }
    const near = (mx, my) => { let best = null, bd = 18; for (const p of pts) { const d = Math.hypot(p.px - mx, p.py - my) - (p.e ? 2 : 0); if (d < bd) { bd = d; best = p; } } return best; };
    function show(best) {
      if (!best) { tip.classList.remove('on'); box.style.cursor = ''; if (M.hover) setHL(null, true); M.hover = null; return; }
      tip.innerHTML = best.sun ? `<b>the sun is overhead here</b><br>${Math.abs(sun.lat).toFixed(1)}°${sun.lat >= 0 ? 'N' : 'S'} ${Math.abs(sun.lon).toFixed(1)}°${sun.lon >= 0 ? 'E' : 'W'} · ${new Date().toISOString().slice(11, 16)} UTC`
        : best.city ? `<b>${esc(best.city.n)}</b><br>${esc(best.city.t)} local${best.city.m ? ' · ' + esc(best.city.m) : ''}`
        : `<b>${esc(best.e.name)}</b><br>${esc(best.e.country || '')}${best.e.severity ? '<br>' + esc(best.e.severity) : ''}<br>${esc(best.e.level)} alert · ${esc(when(best.e))}`;
      tip.style.left = clamp(best.px, 120, W - 120) + 'px'; tip.style.top = best.py + 'px'; tip.classList.add('on'); box.style.cursor = best.e ? 'pointer' : 'default';
      if (best.e) { M.hover = best.e; setHL(best.e.id, true); } else { if (M.hover) setHL(null, true); M.hover = null; } }
    box.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const rc = box.getBoundingClientRect(); show(near(e.clientX - rc.left, e.clientY - rc.top)); });
    box.addEventListener('pointerleave', () => show(null));
    box.addEventListener('click', e => { const rc = box.getBoundingClientRect(), b = near(e.clientX - rc.left, e.clientY - rc.top);
      if (e.pointerType === 'touch' || matchMedia('(hover: none)').matches) { show(b); return; } if (b && b.e && b.e.url) window.open(b.e.url, '_blank', 'noopener'); });
    new ResizeObserver(() => layout()).observe(box);
    document.fonts.load('600 12px JB').finally(() => { layout(); requestAnimationFrame(loop); });
    setInterval(paintBase, 60000);
    return { draw: () => draw(performance.now()), repaint: () => draw(performance.now()), hover: null };
  })();
  tape(); setInterval(tape, 30000);

  // ---------------------------------------------------------------- alerts list, the serious row, filter chips
  function visible() { return S.filter === 'all' ? S.events : S.events.filter(e => e.code === S.filter); }
  function setHL(id) { S.hl = id; $$('#alerts li').forEach(li => li.classList.toggle('hl', li.dataset.id === id)); $$('#sevRow .sc').forEach(a => a.classList.toggle('hl', a.dataset.id === id)); M.draw(); }
  const byRecent = (a, b) => (LW[b.level] - LW[a.level]) || (tms(b.to || b.from) - tms(a.to || a.from));
  const TORDER = ['EQ', 'TC', 'FL', 'WF', 'DR', 'VO', 'TS'];
  const isActive = e => isFinite(tms(e.to)) && Date.now() - tms(e.to) < 3 * 864e5;
  function paintAlerts() {
    const all = S.events, counts = {}; all.forEach(e => { const c = counts[e.code] || (counts[e.code] = { n: 0, red: 0, orange: 0, green: 0 }); c.n++; c[e.level] = (c[e.level] || 0) + 1; });
    const types = Object.keys(counts).sort((a, b) => TORDER.indexOf(a) - TORDER.indexOf(b));
    const tile = (k, g, n, l, c, i) => `<button type="button" class="wt ${S.filter === k ? 'on' : ''}" data-f="${k}" style="--i:${i}" aria-pressed="${S.filter === k}"><span class="g" style="color:${k === 'all' ? C.o : c && (c.red ? C.red : c.orange ? C.o : C.g)}">${g}</span><span class="n">${n}</span><span class="l">${esc(l)}</span>${c ? `<span class="lv3">${['red', 'orange', 'green'].map(lv => c[lv] ? `<i style="width:${c[lv] / c.n * 100}%;background:${LV[lv]}"></i>` : '').join('')}</span>` : `<span class="lv3"><i style="width:100%;background:var(--ink)"></i></span>`}</button>`;
    $('#wStats').innerHTML = tile('all', '#', all.length, 'every alert', null, 0) + types.map((k, i) => tile(k, esc(GLYPH[k] || '*'), counts[k].n, TNAME[k] || k, counts[k], i + 1)).join('');
    const list = visible().slice().sort(byRecent), N = S.showAll ? list.length : 12;
    $('#lCountTxt').textContent = `${list.length} ${S.filter === 'all' ? 'alerts' : (TNAME[S.filter] || S.filter)} · serious first`;
    $('#alerts').innerHTML = list.slice(0, N).map(e => `<li data-id="${esc(e.id)}"><span class="ic" style="color:${LV[e.level]}">${esc(GLYPH[e.code] || '*')}</span><span class="t"><b>${esc(e.name)}</b><small>${esc([e.country, when(e)].filter(Boolean).join(' · '))}</small></span><span class="lv ${esc(e.level)}">${esc(e.level)}</span><a href="${esc(e.url)}" target="_blank" rel="noopener">report ↗</a>
      <span class="more">${e.severity ? esc(e.severity) + '<br>' : ''}${esc(TNAME[e.code] || 'event')} · started ${esc(dm(e.from))}${isFinite(tms(e.to)) && tms(e.to) - tms(e.from) > 864e5 ? ' · last update ' + esc(dm(e.to)) : ''} · ${Math.abs(e.lat).toFixed(1)}°${e.lat >= 0 ? 'N' : 'S'} ${Math.abs(e.lon).toFixed(1)}°${e.lon >= 0 ? 'E' : 'W'}${isActive(e) ? ' · <b style="color:var(--red)">active</b>' : ''}<br><a href="${esc(e.url)}" target="_blank" rel="noopener">open the GDACS report ↗</a></span></li>`).join('');
    $('#moreBtn').hidden = list.length <= 12; $('#moreBtn').textContent = S.showAll ? 'show fewer' : `show all ${list.length}`;
    const sev = all.filter(e => e.level !== 'green').sort(byRecent);
    $('#sev').hidden = !sev.length;
    $('#sevRow').innerHTML = sev.map((e, i) => { const active = isActive(e);
      return `<a class="sc" style="--i:${i}" data-id="${esc(e.id)}" href="${esc(e.url)}" target="_blank" rel="noopener"><span class="top"><span class="g" style="color:${LV[e.level]}">${esc(GLYPH[e.code] || '*')}</span><span class="lv ${esc(e.level)}">${esc(e.level)}</span></span><b>${esc(e.name)}</b><small>${esc(e.severity || TNAME[e.code] || '')}</small><small class="cty">${esc(e.country)}</small><span class="when"><span class="${active ? 'act' : ''}">${active ? '● active' : 'ended'} · ${esc(dm(e.from))}${tms(e.to) - tms(e.from) > 864e5 ? ' – ' + esc(dm(e.to)) : ''}</span><span>GDACS ↗</span></span></a>`; }).join('');
    paintSpot(); TL.set(); paintCountries(); M.draw(); }

  // the spotlight: the most serious alert, with a close-up ASCII map of its region
  const SP = { e: null, t0: 0 };
  function paintSpot() {
    const all = S.events; if (!all.length) { $('#spot').hidden = true; return; }
    const pick = all.slice().sort((a, b) => (LW[b.level] - LW[a.level]) || ((isActive(b) ? 1 : 0) - (isActive(a) ? 1 : 0)) || (tms(b.to || b.from) - tms(a.to || a.from)))[0];
    SP.e = pick; SP.t0 = performance.now(); $('#spot').hidden = false;
    $('#spotK').textContent = pick.level !== 'green' ? (isActive(pick) ? 'the most serious alert right now' : 'the most serious alert this month') : 'the latest alert';
    const near = all.filter(e => e !== pick && Math.abs(e.lat - pick.lat) < 14 && Math.abs(((e.lon - pick.lon + 540) % 360) - 180) < 24).length;
    $('#spotI').innerHTML = `<b>${esc(pick.name)}</b><div class="row"><span><b style="color:${LV[pick.level]}">${esc(pick.level)} alert</b></span><span>${esc(TNAME[pick.code] || 'event')}</span><span>${isActive(pick) ? '<b style="color:var(--red)">active</b>' : 'ended'}</span><span>${esc(when(pick))}</span></div>${pick.severity ? `<div class="row">${esc(pick.severity)}</div>` : ''}<div class="row">${esc(pick.country)}</div><div class="row"><span>${near} other alert${near === 1 ? '' : 's'} nearby</span><a href="${esc(pick.url)}" target="_blank" rel="noopener">the GDACS report ↗</a></div>`;
    drawSpot(performance.now()); }
  function drawSpot(now) { const cv = $('#spotCv'), e = SP.e; if (!e || !cv.clientWidth) return; const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = W * dpr; cv.height = H * dpr; } const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    const spanLon = 48, spanLat = spanLon * H / W, cols = Math.round(W / 6.2), cw = W / cols, fs = cw / .6, ch = fs * 1.18, rows = Math.floor(H / ch), sun = SUN(), lat0 = e.lat + spanLat / 2;
    const latOf = r => lat0 - (r + .5) / rows * spanLat, lonOf = c => e.lon - spanLon / 2 + (c + .5) / cols * spanLon, rv = RM ? 1 : clamp((now - SP.t0) / 900, 0, 1);
    x.font = `600 ${fs}px JB, ui-monospace, monospace`; x.textBaseline = 'alphabetic';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (Math.hypot(c / cols - .5, r / rows - .5) > rv * .75) continue; const la = latOf(r), lo = ((lonOf(c) + 540) % 360) - 180, L = isLand(la, lo), night = sunAlt(la, lo, sun) < -.035, gx = c * cw, gy = r * ch + ch * .78;
      if (L) { const coast = !isLand(la + spanLat / rows, lo) || !isLand(la - spanLat / rows, lo) || !isLand(la, lo + spanLon / cols) || !isLand(la, lo - spanLon / cols); x.globalAlpha = coast ? .95 : night ? .8 : .6; x.fillStyle = coast ? '#3f3d37' : night ? '#5e5a51' : '#8f8a7d'; x.fillText('#', gx, gy); }
      else if ((r + c) % 2 === 0) { x.globalAlpha = night ? .42 : .38; x.fillStyle = night ? NIGHT_SEA : C.b; x.fillText('.', gx, gy); } }
    const X = lo => (((lo - e.lon + 540) % 360) - 180 + spanLon / 2) / spanLon * W, Y = la => (lat0 - la) / spanLat * H;
    x.globalAlpha = .35; x.strokeStyle = C.o; x.lineWidth = 1; x.setLineDash([3, 4]); x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.moveTo(0, H / 2); x.lineTo(W, H / 2); x.stroke(); x.setLineDash([]);
    for (const o of S.events) { if (o === e) continue; const px = X(o.lon), py = Y(o.lat); if (px < 0 || px > W || py < 0 || py > H) continue; x.globalAlpha = 1; x.fillStyle = C.card; x.fillRect(px - 6, py - 8, 12, 14); x.fillStyle = LV[o.level]; x.font = `800 ${fs * 1.4}px JB, ui-monospace, monospace`; x.textAlign = 'center'; x.fillText(GLYPH[o.code] || '*', px, py + 4); x.textAlign = 'left'; }
    const p = (now / 1500) % 1, cx = W / 2, cy = H / 2; for (const k of [0, .5]) { const q = (p + k) % 1; x.globalAlpha = (1 - q) * .8; x.strokeStyle = LV[e.level]; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, 6 + q * 52, 0, 6.283); x.stroke(); }
    x.globalAlpha = 1; x.fillStyle = C.card; x.beginPath(); x.arc(cx, cy, 13, 0, 6.283); x.fill(); x.fillStyle = LV[e.level]; x.font = `800 ${fs * 2.4}px JB, ui-monospace, monospace`; x.textAlign = 'center'; x.fillText(GLYPH[e.code] || '*', cx, cy + fs * .8); x.textAlign = 'left';
    x.font = `500 10.5px DMM, ui-monospace, monospace`; const lb = `${Math.abs(e.lat).toFixed(1)}°${e.lat >= 0 ? 'N' : 'S'}  ${Math.abs(e.lon).toFixed(1)}°${e.lon >= 0 ? 'E' : 'W'}`; x.fillStyle = 'rgba(251,249,244,.94)'; x.fillRect(4, H - 24, x.measureText(lb).width + 12, 18); x.fillStyle = C.ink2; x.fillText(lb, 10, H - 11); }
  (function spotLoop(now) { requestAnimationFrame(spotLoop); if (document.hidden || !SP.e) return; const r = $('#spot').getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; if (now - (spotLoop.l || 0) < 40) return; spotLoop.l = now; drawSpot(now); })(0);

  // the timeline: every alert of the last 30 days, one lane per type, long ones drawn as spans
  const TL = (() => { const cv = $('#tlCv'), tip = $('#tltip'); let W, H, dpr, t0 = 0, seen = false, pts = [];
    const lanes = () => TORDER.filter(k => S.events.some(e => e.code === k));
    function draw(now) { if (!cv.clientWidth) return; dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; if (cv.width !== Math.round(W * dpr)) { cv.width = W * dpr; cv.height = H * dpr; }
      const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H); const L = lanes(), end = Date.now(), span = 30 * 864e5, lh = H / Math.max(1, L.length), LX = 78, P = RM ? 1 : clamp((now - t0) / 1600, 0, seen ? 1 : 0), lim = LX + (W - LX) * eio(P);
      const tx = t => LX + (W - LX) * (1 - (end - t) / span); pts = [];
      x.font = '500 10.5px DMM, ui-monospace, monospace'; x.textBaseline = 'middle';
      L.forEach((k, i) => { const y = lh * i + lh / 2; x.globalAlpha = 1; x.fillStyle = C.ink2; x.fillText((TNAME[k] || k).slice(0, 11), 0, y); x.globalAlpha = .5; x.fillStyle = '#dcd5c5'; x.fillRect(LX, Math.round(y), W - LX, 1); });
      for (let d = 0; d <= 30; d += 5) { const xx = tx(end - d * 864e5); x.globalAlpha = .45; x.fillStyle = '#cfc7b4'; x.fillRect(Math.round(xx), 0, 1, H); }
      for (const e of S.events) { const i = L.indexOf(e.code); if (i < 0) continue; const y = lh * i + lh / 2, a = Math.max(tms(e.from), end - span), b = Math.min(isFinite(tms(e.to)) ? tms(e.to) : a, end); if (!(b >= end - span)) continue;
        const xa = tx(a), xb = Math.max(xa, tx(b)); if (xa > lim) continue; const xbb = Math.min(xb, lim), jit = (hash(e.id.length * 7 + i, Math.round(xa)) - .5) * lh * .5;
        x.globalAlpha = e.level === 'green' ? .55 : .95; x.fillStyle = LV[e.level];
        if (xbb - xa > 3) x.fillRect(xa, y + jit - 1.5, xbb - xa, 3); x.beginPath(); x.arc(xa, y + jit, e.level === 'green' ? 2.4 : 4, 0, 6.283); x.fill(); pts.push({ e, px: xa, py: y + jit }); }
      if (P < 1 && seen) { x.globalAlpha = 1; x.fillStyle = C.o; x.fillRect(lim, 0, 1.5, H); } x.globalAlpha = 1; }
    function loop(now) { requestAnimationFrame(loop); if (document.hidden || now - (loop.l || 0) < 40) return; loop.l = now; const r = cv.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; if (seen && now - t0 > 1800 && !loop.dirty) return; loop.dirty = false; draw(now); }
    new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !seen) { seen = true; t0 = performance.now(); } }), { threshold: .3 }).observe(cv);
    cv.addEventListener('pointermove', ev => { const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top; let b = null, bd = 10; for (const p of pts) { const d = Math.hypot(p.px - mx, p.py - my); if (d < bd) { bd = d; b = p; } }
      if (!b) { tip.classList.remove('on'); return; } tip.innerHTML = `<b>${esc(b.e.name)}</b><br>${esc(b.e.level)} · ${esc(when(b.e))}`; tip.style.left = clamp(b.px, 110, W - 110) + 'px'; tip.style.top = b.py + 'px'; tip.classList.add('on'); });
    cv.addEventListener('pointerleave', () => tip.classList.remove('on'));
    new ResizeObserver(() => { loop.dirty = true; draw(performance.now()); }).observe(cv); requestAnimationFrame(loop);
    return { set: () => { loop.dirty = true; draw(performance.now()); } }; })();

  // countries named in the most alerts
  function paintCountries() { const n = {}; for (const e of S.events) for (const c of String(e.country || '').split(',').map(t => t.trim()).filter(Boolean)) n[c] = (n[c] || 0) + 1;
    const top = Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 8), max = top.length ? top[0][1] : 1;
    $('#ctry').innerHTML = top.length ? top.map(([c, v], i) => `<li style="--i:${i}"><span>${esc(c)}</span><span class="bar"><i style="--w:${(v / max).toFixed(3)}"></i></span><b>${v}</b></li>`).join('') : '<li><span>—</span></li>'; }
  $('#wStats').addEventListener('click', e => { const b = e.target.closest('.wt'); if (!b) return; S.filter = b.dataset.f === S.filter && b.dataset.f !== 'all' ? 'all' : b.dataset.f; S.showAll = false; paintAlerts(); say(`showing ${S.filter === 'all' ? 'every alert' : TNAME[S.filter]}`); });
  $('#alerts').addEventListener('click', e => { if (e.target.closest('a')) return; const li = e.target.closest('li'); if (li) li.classList.toggle('open'); });
  $('#moreBtn').addEventListener('click', () => { S.showAll = !S.showAll; paintAlerts(); });
  $('#alerts').addEventListener('pointerover', e => { const li = e.target.closest('li'); if (li) setHL(li.dataset.id); });
  $('#alerts').addEventListener('pointerleave', () => setHL(null));
  $('#sevRow').addEventListener('pointerover', e => { const a = e.target.closest('.sc'); if (a) setHL(a.dataset.id); });
  $('#sevRow').addEventListener('pointerleave', () => setHL(null));

  // ---------------------------------------------------------------- the planet today (the ink band)
  function paintPlanet(w) { const p = w.planet || {}, st = $('#planetSt');
    st.textContent = `${w.src} · read ${ago(w.at)}`;
    if (p.quakes) { countTo($('#pQuakes'), p.quakes.n); $('#pQuakesS').innerHTML = p.quakes.top ? `strongest: <a href="${esc(p.quakes.top.url)}" target="_blank" rel="noopener">M${esc(p.quakes.top.mag)} ${esc(p.quakes.top.place)} ↗</a>` : ''; }
    else { $('#pQuakes').textContent = '—'; $('#pQuakesS').textContent = 'USGS did not answer'; }
    if (p.cyclones) { countTo($('#pCyc'), p.cyclones.length); $('#pCycS').textContent = p.cyclones.length ? p.cyclones.join(', ') : 'none spinning right now'; }
    if (p.countries != null) { countTo($('#pCountries'), p.countries); $('#pCountriesS').textContent = 'alerts updated in the last 7 days'; }
    if (p.serious) { countTo($('#pSerious'), p.serious.n); $('#pSeriousS').textContent = `${p.serious.red} red · ${p.serious.orange} orange`; } }

  async function loadWorld() {
    const st = $('#worldSt');
    try { const w = await jget('/api/x?a=world', 20000); if (!w.ok || !w.events.length) throw new Error(w.error || 'empty');
      S.events = w.events; S.planet = w.planet || null; const red = w.events.filter(e => e.level === 'red').length, orange = w.events.filter(e => e.level === 'orange').length;
      st.className = 'st live'; st.querySelector('span').textContent = `${w.src} · ${w.events.length} alerts · ${red} red · ${orange} orange · read ${ago(w.at)}`;
      $('#srcLine').textContent = w.note || ''; $('#worldOff').hidden = true;
      $('#gcapTxt').textContent = red + orange ? `live · ${red + orange} red and orange alerts this month · drag to turn` : `live · ${w.events.length} disaster alerts this week · drag to turn`;
      paintAlerts(); paintPlanet(w); $('#planet').classList.remove('off'); SEIS.set(w.planet && w.planet.quakes && w.planet.quakes.list);
    } catch (e) {
      st.className = 'st off'; st.querySelector('span').textContent = 'feed offline'; $('#worldOff').hidden = false; $('#alerts').innerHTML = ''; $('#wStats').innerHTML = ''; $('#sev').hidden = true; $('#spot').hidden = true;
      $('#gcapTxt').textContent = 'the alert feed is offline · drag to turn'; $('#planetSt').textContent = 'GDACS and USGS did not answer'; $('#planet').classList.add('off'); SEIS.set([]); }
  }
  $('#worldRetry').addEventListener('click', () => { $('#worldSt').querySelector('span').textContent = 'reading GDACS…'; $('#worldSt').className = 'st'; loadWorld(); });

  // ---------------------------------------------------------------- the calculator: $WORLD's own Raydium launchpad takes 1% of every curve trade
  const RATE = { kitchen: 1, raydium: .25, pump: .30 };
  const num = s => { const v = parseFloat(String(s || '').replace(/[, _$]/g, '')); return isFinite(v) ? v : NaN; };
  const pct = v => (+v).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + '%';
  const amt = v => `${sol(v)}${S.solUsd ? ' · ' + usd(v * S.solUsd) : ''}`;
  function setCard(c) { S.card = c; $('#cardBtn').disabled = !c; const xa = $('#cardX'); xa.setAttribute('aria-disabled', c ? 'false' : 'true'); xa.classList.toggle('off', !c);
    xa.href = c ? `https://x.com/intent/post?text=${encodeURIComponent(`a ${c.sizeTxt} SOL trade of $WORLD sends ${c.feeTxt} to World Central Kitchen.\n\nevery trade feeds the world.\n${location.origin}`)}` : '#';
    if (!c) $('#share').hidden = true; else if (!$('#share').hidden) drawCard(); }
  function calc() {
    const size = num($('#cSize').value), out = $('#cOut'), why = $('#cWhy');
    const dim = (a, b) => { out.className = 'out dim'; out.textContent = a; why.textContent = b; calc.last = 0; ['#sKit', '#sRay', '#sPump'].forEach(id => $(id).textContent = '—'); setCard(null); };
    if ($('#cSize').value.trim() === '') return dim('type a trade size', '1% of every trade on the bonding curve goes to the kitchen.');
    if (!(size > 0)) return dim('that is not a trade size', 'use a positive number of SOL, like 0.5 or 2.');
    if (size > 1e6) return dim('that trade is bigger than the pool', 'try something under a million SOL.');
    const fee = size * RATE.kitchen / 100;
    out.className = 'out'; const paint = v => { out.innerHTML = `${esc(sol(v))}${S.solUsd ? ` <em>≈ ${esc(usd(v * S.solUsd))}</em>` : ''}`; };
    const from = calc.last || 0; calc.last = fee; cancelAnimationFrame(calc.raf);
    if (RM || !from || Math.abs(from - fee) / fee > 50) paint(fee); else { const t0 = performance.now(); const f = now => { const p = clamp((now - t0) / 420, 0, 1); paint(p < 1 ? lerp(from, fee, eout(p)) : fee); if (p < 1) calc.raf = requestAnimationFrame(f); }; calc.raf = requestAnimationFrame(f); }
    why.textContent = `${size.toLocaleString('en-US', { maximumFractionDigits: 6 })} SOL × 1% = ${fee.toFixed(9).replace(/0+$/, '').replace(/\.$/, '')} SOL to the kitchen, on the bonding curve. Raydium's 0.25% is on top.`;
    $('#sKit').textContent = amt(fee); $('#sRay').textContent = amt(size * RATE.raydium / 100); $('#sPump').textContent = amt(size * RATE.pump / 100);
    say(out.textContent);
    setCard({ sizeTxt: size.toLocaleString('en-US', { maximumFractionDigits: 6 }), feeTxt: sol(fee), feeUsd: S.solUsd ? fee * S.solUsd : null, rate: '1%', where: 'on the bonding curve' }); }
  $('#cSize').addEventListener('input', calc);

  // ---------------------------------------------------------------- the trade card: a picture of what one trade sends
  function sphereTo(ctx, cx, cy, R, cols, lon0, lat0, sun) { const cw = 2 * R / cols, fs = cw / .6, ch = fs * 1.18; ctx.font = `600 ${fs}px JB, ui-monospace, monospace`; ctx.textBaseline = 'alphabetic';
    const a = -lat0 * RAD, b = lon0 * RAD, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    for (let r = Math.floor(-R * 1.05 / ch); r <= Math.ceil(R * 1.05 / ch); r++) for (let c = Math.floor(-R * 1.05 / cw); c <= Math.ceil(R * 1.05 / cw); c++) {
      const px = (c + .5) * cw, py = (r + .5) * ch, nx = px / R, ny = -py / R, q = nx * nx + ny * ny; if (q > 1.09) continue; const gx = cx + c * cw, gy = cy + r * ch + ch * .78;
      if (q > 1) { ctx.globalAlpha = .55; ctx.fillStyle = C.b; ctx.fillText(q < 1.04 ? ':' : '.', gx, gy); continue; }
      const nz = Math.sqrt(1 - q), y1 = ny * ca - nz * sa, z1 = ny * sa + nz * ca, x2 = nx * cb + z1 * sb, z2 = -nx * sb + z1 * cb, lat = Math.asin(clamp(y1, -1, 1)) / RAD, lon = Math.atan2(x2, z2) / RAD;
      const L = lookAt(lat, lon, nz, sun); ctx.globalAlpha = L[2]; ctx.fillStyle = L[1]; ctx.fillText(L[0], gx, gy); }
    ctx.globalAlpha = 1; }
  async function drawCard() { const c = S.card; if (!c) return; const cv = $('#cardCv'), x = cv.getContext('2d'), Wc = 1200, Hc = 675;
    await Promise.all(['400 40px Fraunces', 'italic 400 40px Fraunces', '400 16px DMM', '600 12px JB'].map(f => document.fonts.load(f).catch(() => {})));
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = C.paper; x.fillRect(0, 0, Wc, Hc);
    x.fillStyle = 'rgba(47,127,208,.16)'; for (let yy = 12; yy < Hc; yy += 24) for (let xx = 12 + ((yy / 24) & 1) * 12; xx < Wc; xx += 24) x.fillRect(xx, yy, 1.6, 1.6);
    sphereTo(x, 905, 338, 248, 74, G.lon0, G.lat0, SUN());
    x.fillStyle = C.ink; x.fillRect(0, 0, Wc, 6); x.fillStyle = C.o; x.fillRect(0, 0, 220, 6);
    x.textBaseline = 'alphabetic'; x.fillStyle = C.o2; x.font = '500 21px DMM, monospace'; x.fillText('$WORLD', 64, 92); x.fillStyle = C.ink2; x.font = '400 21px DMM, monospace'; x.fillText('· every trade feeds the world.', 150, 92);
    const fit = (txt, font, max, sz) => { let s = sz; do { x.font = font.replace('#', s); s -= 2; } while (x.measureText(txt).width > max && s > 20); };
    x.fillStyle = C.ink; fit(`a ${c.sizeTxt} SOL trade sends`, '400 #px Fraunces, Georgia, serif', 600, 58); x.fillText(`a ${c.sizeTxt} SOL trade sends`, 60, 262);
    x.fillStyle = C.o; fit(c.feeTxt, 'italic 400 #px Fraunces, Georgia, serif', 610, 124); x.fillText(c.feeTxt, 58, 380);
    x.fillStyle = C.ink; fit('to World Central Kitchen.', '400 #px Fraunces, Georgia, serif', 600, 58); x.fillText('to World Central Kitchen.', 60, 456);
    x.fillStyle = C.ink2; x.font = '400 18px DMM, monospace'; x.fillText(`${c.rate} launchpad fee ${c.where}`.slice(0, 64), 64, 520); x.fillText(`$WORLD's own launchpad on Raydium${c.feeUsd != null ? ` · ≈ ${usd(c.feeUsd)} today` : ''}`, 64, 548);
    x.fillStyle = C.ink; x.font = '500 18px DMM, monospace'; x.fillText(location.host, 64, 620); x.fillStyle = C.mute; x.font = '400 16px DMM, monospace'; x.textAlign = 'right'; x.fillText(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', Wc - 48, 640); x.textAlign = 'left'; }
  $('#cardBtn').addEventListener('click', async () => { if (!S.card) return; $('#share').hidden = false; await drawCard();
    $('#cardCv').toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'world-trade-card.png'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('card saved'); }, 'image/png'); });
  $('#cardX').addEventListener('click', e => { if (!S.card) { e.preventDefault(); toast('type a trade size first'); } });

  // ---------------------------------------------------------------- config, the vault and the ledger
  async function loadCfg() {
    try { const c = await jget('/api/x?a=cfg'); S.cfg = c; S.solUsd = c.sol || null; } catch { S.cfg = { ca: '', x: '', vault: '', cadence: 'daily' }; }
    const c = S.cfg, ss = $('#solSt');
    if (S.solUsd) { ss.className = 'st live'; ss.querySelector('span').textContent = `SOL ${usd(S.solUsd)} · live`; } else { ss.className = 'st off'; ss.querySelector('span').textContent = 'SOL price offline: the curve still works'; }
    if (c.ca) { $('#caTxt').textContent = c.ca; $('#caPill').hidden = false;
      $('#copyCa').addEventListener('click', () => navigator.clipboard.writeText(c.ca).then(() => toast('contract address copied'), () => toast('copy failed: select it by hand')));
      const buy = `https://raydium.io/launchpad/token/?mint=${encodeURIComponent(c.ca)}`; for (const id of ['#navBuy', '#heroBuy']) { $(id).href = buy; $(id).hidden = false; } $('#heroRule').classList.remove('solid'); }
    if (c.x) { const u = /^https?:/.test(c.x) ? c.x : `https://x.com/${c.x.replace(/^@/, '')}`; $('#navX').href = u; $('#navX').hidden = false; }
    const cad = c.cadence === 'hourly' ? 'every hour' : 'at least once a day'; $('#cadTxt').textContent = cad;
    $('#faqCad').textContent = `${cad[0].toUpperCase() + cad.slice(1)}, the whole balance minus a few cents of network fees. Small balances may wait until they're worth more than the cost of sending them.`;
    calc();
  }
  async function loadRay() { const c = S.cfg || {}; if (!c.ca && !c.pad) return;
    const [coin, pad] = await Promise.all([c.ca ? jget('/api/ray?a=coin', 15000).catch(() => null) : null, c.pad ? jget('/api/ray?a=pad', 15000).catch(() => null) : null]);
    if (coin && coin.live && !coin.graduated) $('#nTrade').innerHTML = `${(coin.progress * 100).toFixed(1)}% of the way to graduation<small>${esc(coin.raisedSol.toFixed(2))} of ${esc(coin.raiseSol)} SOL raised on the curve · <a href="https://raydium.io/launchpad/token/?mint=${esc(coin.mint)}" target="_blank" rel="noopener">Raydium ↗</a></small>`;
    if (coin && coin.live && coin.graduated) $('#nTrade').innerHTML = `graduated to a Raydium pool<small><a href="https://raydium.io/launchpad/token/?mint=${esc(coin.mint)}" target="_blank" rel="noopener">see it on Raydium ↗</a></small>`;
    if (pad && pad.exists) { $('#padWait').hidden = false; $('#padWait').innerHTML = `<b>${esc(sol(pad.unclaimedSol))}</b> waiting in the launchpad's fee vault, ready to claim${S.solUsd ? ' · ' + esc(usd(pad.unclaimedSol * S.solUsd)) : ''} · launchpad <a href="https://solscan.io/account/${esc(pad.id)}" target="_blank" rel="noopener">${esc(short(pad.id))} ↗</a> · ${esc(pad.feePct)}% fee`; } }
  async function loadVault() {
    loadRay();
    let v; try { v = await jget('/api/x?a=vault', 20000); } catch { return; }
    if (v.sol) { S.solUsd = v.sol; }
    if (v.coin && v.coin.listed) { $('#nTrade').innerHTML = `${esc(usd(v.coin.vol24))} traded in 24h<small>market cap ${esc(usd(v.coin.mcap))} · <a href="${esc(v.coin.url)}" target="_blank" rel="noopener">chart ↗</a></small>`; }
    else if (v.coin && v.coin.listed === false) { $('#nTrade').innerHTML = `on the bonding curve<small><a href="https://raydium.io/launchpad/token/?mint=${esc(v.coin.ca)}" target="_blank" rel="noopener">see it on Raydium ↗</a></small>`; }
    if (!v.open || !v.vault) return;
    const a = v.vault, rs = $('#routeSt'), ls = $('#ledgerSt');
    if (a.error) { rs.className = ls.className = 'st off'; rs.querySelector('span').textContent = ls.querySelector('span').textContent = a.error; return; }
    const px = S.solUsd, link = `https://solscan.io/account/${a.address}`;
    rs.className = ls.className = 'st live'; rs.querySelector('span').textContent = ls.querySelector('span').textContent = `vault ${short(a.address)} · read live`;
    $('#nVault').innerHTML = `${esc(sol(a.balance))}${px ? ` · ${esc(usd(a.balance * px))}` : ''}<small><a href="${link}" target="_blank" rel="noopener">${esc(short(a.address))} on Solscan ↗</a></small>`;
    $('#nOut').innerHTML = a.out.length ? `${esc(sol(a.totalOut))} sent<small>${a.out.length} send${a.out.length === 1 ? '' : 's'} · last ${esc(ago(a.out[0].t))}</small>` : `nothing sent yet<small>the first send will be listed in plate 06</small>`;
    $('#lBal').innerHTML = `${esc(sol(a.balance))}<small>${px ? esc(usd(a.balance * px)) : ''}</small>`;
    $('#lOut').innerHTML = `${esc(sol(a.totalOut))}<small>${px ? '≈ ' + esc(usd(a.totalOut * px)) + ' at today\'s price' : ''}</small>`;
    $('#lCount').innerHTML = `${a.out.length}<small>${a.out.length ? 'last ' + esc(ago(a.out[0].t)) : 'none yet'}</small>`;
    $('#lIn').innerHTML = `${esc(sol(a.totalIn))}<small>in the last ${a.seen} transactions</small>`;
    $('#lRows').innerHTML = a.out.length ? a.out.map(o => `<tr><td>${o.t ? esc(new Date(o.t).toISOString().slice(0, 16).replace('T', ' ')) + ' UTC' : '—'}</td><td class="m">${esc(sol(o.sol))}</td><td class="m">${esc(o.to || '—')}</td><td class="m"><a href="https://solscan.io/tx/${esc(o.sig)}" target="_blank" rel="noopener">tx ↗</a> ${o.receipt ? `· <a href="${esc(o.receipt)}" target="_blank" rel="noopener">receipt ↗</a>` : '<span class="warn">· no receipt yet</span>'}</td></tr>`).join('')
      : `<tr><td colspan="4">No sends yet. The first one will be listed here with its transaction.</td></tr>`;
    $('#lNote').innerHTML = `Read from the last ${a.seen} transactions of <a href="${link}" target="_blank" rel="noopener">${esc(a.address)} ↗</a>. Sends are marked "no receipt yet" until a Giving Block receipt is attached.`;
  }

  // ---------------------------------------------------------------- the seismograph: every M2.5+ earthquake of the last 24 hours (USGS)
  const SEIS = (() => {
    const box = $('#seis'), cv = $('#seisCv'), x = cv.getContext('2d'), tip = $('#stip'); let W, H, dpr, list = [], drawn = 0, t0 = 0, seen = false, pts = [], last = 0;
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = box.clientWidth; H = cv.clientHeight || 96; cv.width = W * dpr; cv.height = H * dpr; };
    const amp = m => clamp((m - 2) / 5, .06, 1);
    function draw(now) { if (!W) return; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H); const mid = H * .62, span = 864e5, end = Date.now(), p = RM ? 1 : clamp((now - t0) / 1800, 0, seen ? 1 : 0);
      // hour ticks
      x.globalAlpha = .5; x.fillStyle = '#5a574f'; for (let h = 0; h <= 24; h++) { const xx = W * h / 24; x.fillRect(Math.round(xx), mid + 18, 1, h % 6 ? 3 : 7); }
      // the trace: a flat line with a spike at every quake's real time, height by magnitude
      const lim = W * eio(p); x.globalAlpha = 1; x.strokeStyle = '#d9d3c4'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(0, mid); pts = [];
      const qs = list.map(q => ({ q, px: W * (1 - (end - q[0]) / span) })).filter(o => o.px >= 0 && o.px <= W).sort((a, b) => a.px - b.px);
      let cur = 0; for (const o of qs) { if (o.px > lim) break; const a = amp(o.q[1]) * (mid - 6), w = 2.2 + amp(o.q[1]) * 3; x.lineTo(o.px - w, mid); x.lineTo(o.px - w / 2, mid - a); x.lineTo(o.px, mid + a * .55); x.lineTo(o.px + w / 2, mid - a * .3); x.lineTo(o.px + w, mid); pts.push(o); cur = o.px + w; }
      x.lineTo(lim, mid); x.stroke();
      for (const o of pts) if (o.q[1] >= 4.5) { const a = amp(o.q[1]) * (mid - 6); x.fillStyle = C.o; x.fillRect(o.px - 1.5, mid - a - 6, 3, 3); }
      // the pen
      if (p < 1 || seen) { const jx = lim, jy = mid + (p < 1 ? 0 : Math.sin(now / 90) * .8); x.fillStyle = C.o; x.beginPath(); x.arc(jx, jy, 3.2, 0, 6.283); x.fill(); x.globalAlpha = .35; x.beginPath(); x.arc(jx, jy, 3.2 + ((now / 900) % 1) * 9, 0, 6.283); x.strokeStyle = C.o; x.stroke(); x.globalAlpha = 1; } }
    function loop(now) { requestAnimationFrame(loop); if (document.hidden || now - last < 33) return; const r = box.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; last = now; draw(now); }
    new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !seen) { seen = true; t0 = performance.now(); } }), { threshold: .3 }).observe(box);
    box.addEventListener('pointermove', e => { const rc = box.getBoundingClientRect(), mx = e.clientX - rc.left; let b = null, bd = 10; for (const o of pts) { const d = Math.abs(o.px - mx); if (d < bd) { bd = d; b = o; } }
      if (!b) { tip.classList.remove('on'); return; } tip.innerHTML = `<b>M${esc(b.q[1].toFixed(1))}</b> ${esc(b.q[2])}<br>${esc(ago(b.q[0]))}`; tip.style.left = clamp(b.px, 110, W - 110) + 'px'; tip.style.top = (H * .62 - amp(b.q[1]) * (H * .62 - 6)) + 'px'; tip.classList.add('on'); });
    box.addEventListener('pointerleave', () => tip.classList.remove('on'));
    new ResizeObserver(() => { size(); draw(performance.now()); }).observe(box); size(); requestAnimationFrame(loop);
    return { set: l => { list = l || []; $('#seisN').textContent = list.length ? `${list.length} quakes · ${list.filter(q => q[1] >= 4.5).length} of M4.5 or more` : 'USGS did not answer'; } };
  })();

  // ---------------------------------------------------------------- World Central Kitchen, from its own front page
  async function loadWck() {
    const st = $('#wSrc'); let w; try { w = await jget('/api/x?a=wck', 15000); } catch { w = { ok: false }; }
    if (w.ok && w.meals) { const n = w.meals.n; countTo($('#wMeals'), n); $('#wUnit').textContent = ` ${w.meals.unit}+`; st.innerHTML = `read from <a href="https://wck.org" target="_blank" rel="noopener">wck.org ↗</a> ${esc(ago(w.at))}`; }
    else { $('#wMeals').textContent = '—'; st.innerHTML = `wck.org did not answer just now · <a href="https://wck.org" target="_blank" rel="noopener">see it there ↗</a>`; }
    const items = (w.ok && w.items) || [];
    $('#wItems').innerHTML = items.length ? items.map((it, i) => `<li style="--i:${i}"><span class="n">0${i + 1}</span><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)} ↗</a></li>`).join('') : `<li><span class="n">—</span><a href="https://wck.org/relief/" target="_blank" rel="noopener">WCK's responses are listed on wck.org ↗</a></li>`; }

  // ---------------------------------------------------------------- headings rise word by word as they arrive
  $$('.plate h2').forEach(h => { let i = 0; const walk = n => { [...n.childNodes].forEach(c => { if (c.nodeType === 3) { const f = document.createDocumentFragment(); c.textContent.split(/(\s+)/).forEach(w => { if (!w) return; if (/^\s+$/.test(w)) f.append(w); else { const s = document.createElement('span'); s.className = 'hw'; s.style.setProperty('--i', i++); s.textContent = w; f.append(s); } }); c.replaceWith(f); } else if (c.nodeType === 1) walk(c); }); }; walk(h); });

  // ---------------------------------------------------------------- the phone menu and the reading line
  (() => { const b = $('#menuBtn'), sh = $('#sheet'); const set = v => { if (v) { const nb = $('.nav').getBoundingClientRect().bottom; sh.style.top = nb + 'px'; sh.style.maxHeight = `calc(100vh - ${nb}px)`; } sh.hidden = !v; b.setAttribute('aria-expanded', v); b.textContent = v ? 'close' : 'menu'; document.documentElement.classList.toggle('menu-open', v); };
    b.addEventListener('click', () => set(sh.hidden)); sh.addEventListener('click', e => { if (e.target.closest('a')) set(false); }); addEventListener('keydown', e => { if (e.key === 'Escape' && !sh.hidden) set(false); }); })();

  // ---------------------------------------------------------------- motion everywhere
  // giant outline section numbers that drift against the scroll
  const BIG = $$('.plate').map(pl => { const n = (pl.querySelector('.eyebrow b') || {}).textContent; if (!n) return null; const el = document.createElement('span'); el.className = 'bignum'; el.setAttribute('aria-hidden', 'true'); el.textContent = n; pl.prepend(el); return { pl, el }; }).filter(Boolean);
  // eyebrow labels decode from glyphs when their plate arrives
  $$('.plate .eyebrow').forEach(eb => { const b = eb.querySelector('b'); if (!b) return; const tn = b.nextSibling; if (!tn || tn.nodeType !== 3) return; const sp = document.createElement('span'); sp.className = 'tx'; sp.textContent = tn.textContent; sp.dataset.t = tn.textContent; tn.replaceWith(sp); });
  function scramble(sp) { if (RM || sp.dataset.done) return; sp.dataset.done = 1; const T = sp.dataset.t, t0 = performance.now(), d = 700;
    const f = now => { const p = clamp((now - t0) / d, 0, 1), n = Math.floor(T.length * p); sp.textContent = T.slice(0, n) + T.slice(n).replace(/\S/g, () => DUST[Math.floor(Math.random() * DUST.length)]); if (p < 1) requestAnimationFrame(f); else sp.textContent = T; }; requestAnimationFrame(f); }
  // the rule's big sentence lights up word by word as you read down the plate
  const BIGQ = $('.rule .big'); const QW = [];
  if (BIGQ) { const walk = n => [...n.childNodes].forEach(c => { if (c.nodeType === 3) { const f = document.createDocumentFragment(); c.textContent.split(/(\s+)/).forEach(w => { if (!w) return; if (/^\s+$/.test(w)) f.append(w); else { const sp = document.createElement('span'); sp.className = 'sw'; sp.textContent = w; QW.push(sp); f.append(sp); } }); c.replaceWith(f); } else if (c.nodeType === 1) walk(c); }); walk(BIGQ); }
  // magnetic buttons (mouse only)
  if (!RM && matchMedia('(hover: hover) and (pointer: fine)').matches) $$('.btn,.pill,.ca button').forEach(b => {
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); b.style.transform = `translate(${clamp(dx * .22, -8, 8)}px,${clamp(dy * .32, -6, 6)}px)`; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; }); });
  // the closing marquee: speeds up with the scroll, and runs backwards when you scroll up
  const MQ = $('#mqIn'); if (MQ) { const unit = '<span>every trade feeds the <em>world.</em></span><i>*</i>'; MQ.innerHTML = unit.repeat(6); }
  let mqX = 0, mqV = 0, lastY = scrollY, lastT = performance.now();
  function scrollFx() { const vh = innerHeight;
    for (const b of BIG) { const r = b.pl.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) continue; b.el.style.transform = `translate3d(0,${((r.top - vh * .3) * -.22).toFixed(1)}px,0)`; }
    if (BIGQ && QW.length) { const r = BIGQ.closest('.plate').getBoundingClientRect(), p = clamp((vh * .78 - r.top) / (r.height * .55), 0, 1), n = Math.round(p * QW.length); QW.forEach((w, i) => w.classList.toggle('on', i < n)); } }
  if (!RM) { addEventListener('scroll', scrollFx, { passive: true }); scrollFx(); } else QW.forEach(w => w.classList.add('on'));
  (function mqLoop(now) { requestAnimationFrame(mqLoop); if (!MQ || document.hidden) return; const dt = Math.min(64, now - lastT); lastT = now; const dy = scrollY - lastY; lastY = scrollY;
    mqV += (dy * .9 - mqV) * .1; const r = MQ.getBoundingClientRect(); if (r.bottom < -50 || r.top > innerHeight + 50) return; const half = MQ.scrollWidth / 2;
    mqX -= (RM ? 0 : .045 * dt) + mqV * .6; if (half) { mqX = ((mqX % half) - half) % half; } MQ.style.transform = `translate3d(${mqX.toFixed(1)}px,0,0)`; })(performance.now());

  // ---------------------------------------------------------------- reveal, scroll-spy, hero
  const onVis = el => { el.classList.add('vis'); const sp = el.querySelector('.eyebrow .tx'); if (sp) scramble(sp); };
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { onVis(e.target); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach(el => io.observe(el));
  const sweep = () => $$('.rv:not(.vis)').forEach(el => { if (el.getBoundingClientRect().top < innerHeight * .95) onVis(el); });
  addEventListener('scroll', sweep, { passive: true }); addEventListener('hashchange', () => setTimeout(sweep, 60));
  const links = $$('#links a').filter(a => a.getAttribute('href').startsWith('#')), secs = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  const spy = () => { let cur = null; for (const s of secs) if (s.getBoundingClientRect().top < 140) cur = s.id; links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + cur)); };
  addEventListener('scroll', spy, { passive: true }); spy();
  $$('#h1 .w').forEach((w, i) => w.style.transitionDelay = (120 + i * 90) + 'ms');
  if (INTRO) G.done.then(() => requestAnimationFrame(introRun)); else { const ie = $('#intro'); if (ie) ie.remove(); requestAnimationFrame(() => $('.hero').classList.add('go')); }

  loadCfg().then(loadVault); loadWorld(); loadWck();
  setInterval(loadWorld, 10 * 60 * 1000); setInterval(loadVault, 60 * 1000);
})();
