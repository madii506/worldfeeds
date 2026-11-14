/* $WORLD — the site. A live ASCII globe, a world map of live GDACS alerts, a fee calculator that follows pump.fun's
   published table to the decimal, and a ledger read straight from Solana. No numbers on this page are invented. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = { ink: '#151513', ink2: '#4c4a44', mute: '#8b877c', o: '#ff5a1f', o2: '#e4460c', g: '#159a52', b: '#2f7fd0', red: '#d0372a', paper: '#f6f3ec', card: '#fbf9f4' };
  const LV = { red: C.red, orange: C.o, green: C.g }, LW = { red: 3, orange: 2, green: 1 };
  const GLYPH = { EQ: '*', FL: '~', TC: '@', WF: '^', DR: '%', VO: 'A', TS: '~' }, TNAME = { EQ: 'earthquakes', FL: 'floods', TC: 'cyclones', WF: 'wildfires', DR: 'droughts', VO: 'volcanoes', TS: 'tsunamis' };
  const RAMP = ' .:-=+*#%@';
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1800); };
  const say = m => { $('#live').textContent = m; };
  const usd = v => v == null || !isFinite(v) ? '—' : '$' + (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(v >= .01 ? 3 : 4));
  const trim = s => s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, '');
  const sol = v => v == null || !isFinite(v) ? '—' : (v >= 100 ? v.toFixed(2) : v >= 1 ? trim(v.toFixed(4)) : trim(v.toFixed(6))) + ' SOL';
  const ago = t => { if (!t) return ''; const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000); return s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago'; };
  const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
  const jget = async (u, ms = 12000) => { const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms); try { const r = await fetch(u, { signal: ac.signal, cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(t); } };

  // ---------------------------------------------------------------- the land mask (0.5° equirectangular bitmap)
  const LM = (() => { const L = window.LAND; if (!L) return null; const bin = atob(L.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return { w: L.w, h: L.h, u }; })();
  const isLand = (lat, lon) => { if (!LM) return false; let x = Math.floor((lon + 180) / 360 * LM.w); x = ((x % LM.w) + LM.w) % LM.w; const y = clamp(Math.floor((90 - lat) / 180 * LM.h), 0, LM.h - 1), i = y * LM.w + x; return (LM.u[i >> 3] >> (i & 7)) & 1; };

  // ---------------------------------------------------------------- the ground: a dotted sea that drifts
  (() => { const cv = $('#ground'), x = cv.getContext('2d'); let W, H, dpr, raf, last = 0; const S = 24;
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; draw(0); };
    function draw(ts) { x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H); const ox = (ts / 260) % S, oy = (ts / 520) % S; x.fillStyle = 'rgba(47,127,208,.13)';
      for (let yy = -S + oy; yy < H + S; yy += S) for (let xx = -S + ox + ((Math.round((yy - oy) / S) & 1) ? S / 2 : 0); xx < W + S; xx += S) { const w = .55 + .45 * Math.sin(xx * .011 + ts / 3200) * Math.cos(yy * .013 - ts / 4100); x.globalAlpha = .35 + .65 * w; x.fillRect(xx, yy, 1.6, 1.6); } x.globalAlpha = 1; }
    const loop = ts => { raf = requestAnimationFrame(loop); if (document.hidden || ts - last < 50) return; last = ts; draw(ts); };
    addEventListener('resize', size); size(); if (!RM) raf = requestAnimationFrame(loop); })();

  // ---------------------------------------------------------------- the clock
  const tickClock = () => { const d = new Date(); $('#clock').innerHTML = 'UTC <b>' + d.toISOString().slice(11, 19) + '</b>'; };
  tickClock(); setInterval(tickClock, 1000);

  // ---------------------------------------------------------------- the mealtime tape: real local time in 48 cities
  const CITIES = [['Lagos', 'Africa/Lagos'], ['Port-au-Prince', 'America/Port-au-Prince'], ['Manila', 'Asia/Manila'], ['Lima', 'America/Lima'], ['Nairobi', 'Africa/Nairobi'], ['Kyiv', 'Europe/Kyiv'], ['Dhaka', 'Asia/Dhaka'], ['Mexico City', 'America/Mexico_City'],
    ['Istanbul', 'Europe/Istanbul'], ['Jakarta', 'Asia/Jakarta'], ['São Paulo', 'America/Sao_Paulo'], ['Cairo', 'Africa/Cairo'], ['Karachi', 'Asia/Karachi'], ['New Orleans', 'America/Chicago'], ['Kinshasa', 'Africa/Kinshasa'], ['Tokyo', 'Asia/Tokyo'],
    ['Bogotá', 'America/Bogota'], ['Addis Ababa', 'Africa/Addis_Ababa'], ['Delhi', 'Asia/Kolkata'], ['Los Angeles', 'America/Los_Angeles'], ['Johannesburg', 'Africa/Johannesburg'], ['Bangkok', 'Asia/Bangkok'], ['Madrid', 'Europe/Madrid'], ['Santiago', 'America/Santiago'],
    ['Khartoum', 'Africa/Khartoum'], ['Kathmandu', 'Asia/Kathmandu'], ['Antananarivo', 'Indian/Antananarivo'], ['New York', 'America/New_York'], ['Tehran', 'Asia/Tehran'], ['Accra', 'Africa/Accra'], ['Sydney', 'Australia/Sydney'], ['San Juan', 'America/Puerto_Rico'],
    ['Beirut', 'Asia/Beirut'], ['Dakar', 'Africa/Dakar'], ['Yangon', 'Asia/Yangon'], ['Guatemala City', 'America/Guatemala'], ['Kabul', 'Asia/Kabul'], ['London', 'Europe/London'], ['Tegucigalpa', 'America/Tegucigalpa'], ['Hanoi', 'Asia/Ho_Chi_Minh'],
    ['Maputo', 'Africa/Maputo'], ['Honolulu', 'Pacific/Honolulu'], ['Lahore', 'Asia/Karachi'], ['Rome', 'Europe/Rome'], ['Caracas', 'America/Caracas'], ['Auckland', 'Pacific/Auckland'], ['Kampala', 'Africa/Kampala'], ['Seoul', 'Asia/Seoul']];
  const fmts = {}; const local = tz => { try { const f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })); return f.format(new Date()); } catch { return null; } };
  const meal = hm => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number), v = h + m / 60; return v >= 6.5 && v < 9 ? 'breakfast' : v >= 12 && v < 14 ? 'lunch' : v >= 18 && v < 21 ? 'dinner' : ''; };
  function tape() { const items = CITIES.map(([n, tz]) => { const t = local(tz); return { n, t, m: meal(t) }; }).filter(i => i.t), mealN = items.filter(i => i.m).length;
    $('#mealN').textContent = `${mealN} of ${items.length}`;
    const html = items.map(i => `<span class="${i.m ? 'meal' : ''}"><b>${esc(i.n.toUpperCase())}</b> ${i.t}${i.m ? ` <em>${i.m}</em>` : ''}</span>`).join('');
    $('#tape').innerHTML = html + html; }
  tape(); setInterval(tape, 30000);

  // ---------------------------------------------------------------- state
  const S = { cfg: null, solUsd: null, events: [], filter: 'all', showAll: false, hl: null };

  // ---------------------------------------------------------------- the globe
  const G = (() => {
    const box = $('#globe'), cv = $('#globeCv'), x = cv.getContext('2d'), tip = $('#gtip');
    let size, dpr, R, cx, cy, cols, fs, cw, ch, cells = [], lon0 = -12, lat0 = 16, vlon = 0, vlat = 0, drag = null, lastInput = -1e9, t0 = performance.now(), last = 0, markers = [];
    const L = (() => { const v = [-.45, .5, .74], n = Math.hypot(...v); return v.map(a => a / n); })();
    function layout() { dpr = Math.min(2, devicePixelRatio || 1); size = box.clientWidth; if (!size) return; cv.width = size * dpr; cv.height = size * dpr; R = size * .455; cx = size / 2; cy = size / 2;
      cols = size > 470 ? 96 : 70; cw = 2 * R / cols; fs = cw / .6; ch = fs * 1.18; cells = [];
      const c0 = Math.floor((cx - R * 1.06) / cw), c1 = Math.ceil((cx + R * 1.06) / cw), r0 = Math.floor((cy - R * 1.06) / ch), r1 = Math.ceil((cy + R * 1.06) / ch);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const px = (c + .5) * cw, py = (r + .5) * ch, nx = (px - cx) / R, ny = -(py - cy) / R, q = nx * nx + ny * ny; if (q > 1.1) continue;
        const rim = q > 1, nz = rim ? 0 : Math.sqrt(1 - q), shade = rim ? 0 : Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        cells.push({ c, r, nx, ny, nz, rim, lit: .24 + .76 * Math.pow(shade, .85), d: Math.sqrt(q), h: hash(c + 99, r + 7) }); } }
    const toWorld = (nx, ny, nz) => { const a = -lat0 * Math.PI / 180, b = lon0 * Math.PI / 180; const y1 = ny * Math.cos(a) - nz * Math.sin(a), z1 = ny * Math.sin(a) + nz * Math.cos(a), x2 = nx * Math.cos(b) + z1 * Math.sin(b), z2 = -nx * Math.sin(b) + z1 * Math.cos(b);
      return [Math.asin(clamp(y1, -1, 1)) * 180 / Math.PI, Math.atan2(x2, z2) * 180 / Math.PI]; };
    const toView = (lat, lon) => { const la = lat * Math.PI / 180, lo = lon * Math.PI / 180, wx = Math.cos(la) * Math.sin(lo), wy = Math.sin(la), wz = Math.cos(la) * Math.cos(lo), b = -lon0 * Math.PI / 180, a = lat0 * Math.PI / 180;
      const x1 = wx * Math.cos(b) + wz * Math.sin(b), z1 = -wx * Math.sin(b) + wz * Math.cos(b), y2 = wy * Math.cos(a) - z1 * Math.sin(a), z2 = wy * Math.sin(a) + z1 * Math.cos(a); return [x1, y2, z2]; };
    let curF = '';
    function frame(now) {
      const t = now - t0; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, size, size); x.textBaseline = 'alphabetic';
      const f = `600 ${fs}px JB, ui-monospace, monospace`; x.font = f; curF = f;
      for (const k of cells) { const rv = 120 + k.d * 820 + k.h * 260; if (!RM && t < rv) continue;
        const gx = k.c * cw, gy = k.r * ch + ch * .78;
        if (!RM && t < rv + 160) { x.globalAlpha = .45; x.fillStyle = C.g; x.fillText('01<>/\\|=+*#%'[Math.floor(hash(k.c, k.r + Math.floor(t / 45)) * 14)], gx, gy); continue; }
        if (k.rim) { if (k.d < 1.045) { x.globalAlpha = .55; x.fillStyle = C.b; x.fillText(k.d < 1.02 ? ':' : '.', gx, gy); } continue; }
        const [lat, lon] = toWorld(k.nx, k.ny, k.nz);
        if (isLand(lat, lon)) { x.globalAlpha = .45 + .55 * k.lit; x.fillStyle = C.g; x.fillText(RAMP[5 + Math.round(k.lit * 3)], gx, gy); }
        else { x.globalAlpha = .28 + .6 * k.lit; x.fillStyle = C.b; x.fillText(k.lit > .72 ? ':' : '.', gx, gy); } }
      // live alerts on the globe: a cleared cell with the alert's glyph, ripples on orange and red
      markers = []; if (t > 900 || RM) for (const e of S.events) { const [vx, vy, vz] = toView(e.lat, e.lon); if (vz < .12) continue; const c = Math.floor((cx + vx * R) / cw), r = Math.floor((cy - vy * R) / ch), px = (c + .5) * cw, py = (r + .5) * ch;
        markers.push({ e, px, py }); const hl = S.hl === e.id;
        x.globalAlpha = 1; x.fillStyle = C.paper; x.fillRect(c * cw - cw * .6, r * ch - ch * .15, cw * 2.2, ch * 1.3);
        if (e.level !== 'green' || hl) { const p = ((now / 1600) + hash(c, r)) % 1; x.globalAlpha = (1 - p) * (hl ? .9 : .55); x.strokeStyle = LV[e.level]; x.lineWidth = 1.2; x.beginPath(); x.arc(px, py, 4 + p * (hl ? 22 : 15), 0, 6.283); x.stroke(); }
        x.globalAlpha = 1; x.fillStyle = LV[e.level] || C.o; x.font = `800 ${fs * 1.55}px JB, ui-monospace, monospace`; x.textAlign = 'center'; x.fillText(GLYPH[e.code] || '*', px, py + fs * .5); x.textAlign = 'left'; x.font = f; }
      x.globalAlpha = 1;
    }
    function loop(now) { requestAnimationFrame(loop); if (document.hidden || !size) return; if (now - last < 33) return; const dt = Math.min(80, now - (last || now)); last = now;
      if (!drag) { if (now - lastInput > 1800 && !RM) vlon += (-.0062 * dt - vlon) * .04; lon0 += vlon; lat0 = clamp(lat0 + vlat, -60, 70); vlat *= .9; if (now - lastInput > 1800) lat0 += (16 - lat0) * .01; }
      frame(now); }
    box.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, lon0, lat0, t: performance.now() }; box.setPointerCapture(e.pointerId); vlon = 0; vlat = 0; lastInput = performance.now(); tip.classList.remove('on'); });
    box.addEventListener('pointermove', e => { const rc = box.getBoundingClientRect();
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y, k = 180 / (R * Math.PI) * .95; const nl = drag.lon0 - dx * k, nt = clamp(drag.lat0 + dy * k, -60, 70); vlon = (nl - lon0) * .5; vlat = 0; lon0 = nl; lat0 = nt; lastInput = performance.now(); return; }
      const mx = e.clientX - rc.left, my = e.clientY - rc.top; let best = null, bd = 16; for (const m of markers) { const d = Math.hypot(m.px - mx, m.py - my); if (d < bd) { bd = d; best = m; } }
      if (best) { tip.innerHTML = `<b>${esc(best.e.name)}</b><br>${esc(best.e.level)} alert · ${esc(ago(best.e.from))}`; tip.style.left = best.px + 'px'; tip.style.top = best.py + 'px'; tip.classList.add('on'); box.style.cursor = 'pointer'; G.hover = best.e; }
      else { tip.classList.remove('on'); box.style.cursor = ''; G.hover = null; } });
    const end = e => { if (!drag) return; const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y); drag = null; lastInput = performance.now(); if (moved < 4 && G.hover && G.hover.url) window.open(G.hover.url, '_blank', 'noopener'); };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', () => { drag = null; }); box.addEventListener('pointerleave', () => tip.classList.remove('on'));
    new ResizeObserver(layout).observe(box);
    document.fonts.load('600 12px JB').finally(() => { layout(); t0 = performance.now(); requestAnimationFrame(loop); });
    return { hover: null, layout };
  })();

  // ---------------------------------------------------------------- the flat world map (section 04)
  const M = (() => {
    const box = $('#map'), cv = $('#mapCv'), x = cv.getContext('2d'), tip = $('#mtip'), base = document.createElement('canvas'), bx = base.getContext('2d');
    const LAT0 = 78, LAT1 = -57; let W, H, dpr, cols, rows, cw, ch, fs, pts = [], last = 0;
    function layout() { dpr = Math.min(2, devicePixelRatio || 1); W = box.clientWidth; if (!W) return; cols = clamp(Math.round(W / 5.6), 96, 290); cw = W / cols; fs = cw / .6; ch = fs * 1.18; H = Math.round(Math.max(240, W * (LAT0 - LAT1) / 360 * .98)); rows = Math.floor(H / ch);
      cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px'; base.width = cv.width; base.height = cv.height; paintBase(); }
    const lonOf = c => -180 + (c + .5) / cols * 360, latOf = r => LAT0 - (r + .5) / rows * (LAT0 - LAT1);
    function paintBase() { bx.setTransform(dpr, 0, 0, dpr, 0, 0); bx.clearRect(0, 0, W, H); bx.textBaseline = 'alphabetic'; bx.font = `600 ${fs}px JB, ui-monospace, monospace`;
      const land = []; for (let r = 0; r < rows; r++) { land.push([]); for (let c = 0; c < cols; c++) land[r].push(isLand(latOf(r), lonOf(c))); }
      const at = (r, c) => r >= 0 && r < rows && land[r][(c + cols) % cols];
      const eqR = Math.round((LAT0 - 0) / (LAT0 - LAT1) * rows - .5);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const gx = c * cw, gy = r * ch + ch * .78;
        if (land[r][c]) { const coast = !at(r - 1, c) || !at(r + 1, c) || !at(r, c - 1) || !at(r, c + 1); bx.globalAlpha = coast ? .95 : .66; bx.fillStyle = coast ? '#3f3d37' : '#8a8578'; bx.fillText('#', gx, gy); }
        else if (r === eqR) { if (c % 2 === 0) { bx.globalAlpha = .55; bx.fillStyle = C.b; bx.fillText('-', gx, gy); } }
        else if (r % 2 === 0 && c % 2 === 0) { bx.globalAlpha = .38; bx.fillStyle = C.b; bx.fillText('.', gx, gy); } }
      bx.globalAlpha = 1; draw(performance.now()); }
    function draw(now) { if (!W) return; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(base, 0, 0); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.textBaseline = 'alphabetic';
      pts = []; const list = visible();
      for (const e of list) { const c = Math.floor((e.lon + 180) / 360 * cols), r = Math.floor((LAT0 - e.lat) / (LAT0 - LAT1) * rows); if (r < 0 || r >= rows) continue; const px = (c + .5) * cw, py = (r + .5) * ch, hl = S.hl === e.id;
        pts.push({ e, px, py });
        if (e.level !== 'green' || hl) { const p = ((now / 1700) + hash(c, r)) % 1; x.globalAlpha = (1 - p) * (hl ? .95 : .6); x.strokeStyle = LV[e.level]; x.lineWidth = hl ? 1.8 : 1.2; x.beginPath(); x.arc(px, py, 5 + p * (hl ? 30 : 20), 0, 6.283); x.stroke(); } }
      for (const p of pts) { const hl = S.hl === p.e.id; x.globalAlpha = 1; x.fillStyle = C.card; x.fillRect(p.px - cw * .9, p.py - ch * .5, cw * 1.8, ch); x.fillStyle = LV[p.e.level] || C.o; x.font = `800 ${fs * (hl ? 1.7 : 1.3)}px JB, ui-monospace, monospace`; x.textAlign = 'center'; x.fillText(GLYPH[p.e.code] || '*', p.px, p.py + fs * (hl ? .55 : .42)); }
      x.textAlign = 'left'; x.globalAlpha = 1; }
    function loop(now) { requestAnimationFrame(loop); if (document.hidden || now - last < 50) return; const r = box.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; last = now; draw(now); }
    box.addEventListener('pointermove', e => { const rc = box.getBoundingClientRect(), mx = e.clientX - rc.left, my = e.clientY - rc.top; let best = null, bd = 18; for (const p of pts) { const d = Math.hypot(p.px - mx, p.py - my); if (d < bd) { bd = d; best = p; } }
      if (best) { tip.innerHTML = `<b>${esc(best.e.name)}</b><br>${esc(best.e.country || '')}${best.e.severity ? '<br>' + esc(best.e.severity) : ''}<br>${esc(best.e.level)} alert · ${esc(ago(best.e.from))}`; tip.style.left = best.px + 'px'; tip.style.top = best.py + 'px'; tip.classList.add('on'); box.style.cursor = 'pointer'; M.hover = best.e; setHL(best.e.id, true); }
      else { tip.classList.remove('on'); box.style.cursor = ''; if (M.hover) setHL(null, true); M.hover = null; } });
    box.addEventListener('pointerleave', () => { tip.classList.remove('on'); if (M.hover) setHL(null, true); M.hover = null; });
    box.addEventListener('click', () => { if (M.hover && M.hover.url) window.open(M.hover.url, '_blank', 'noopener'); });
    new ResizeObserver(() => layout()).observe(box);
    document.fonts.load('600 12px JB').finally(() => { layout(); requestAnimationFrame(loop); });
    return { draw: () => draw(performance.now()), hover: null };
  })();

  // ---------------------------------------------------------------- alerts list + filter chips
  const visible = () => S.filter === 'all' ? S.events : S.events.filter(e => e.code === S.filter);
  function setHL(id, fromMap) { S.hl = id; $$('#alerts li').forEach(li => li.classList.toggle('hl', li.dataset.id === id)); M.draw(); }
  function paintAlerts() {
    const all = S.events, counts = {}; all.forEach(e => counts[e.code] = (counts[e.code] || 0) + 1);
    const chips = [['all', 'all', all.length], ...Object.keys(counts).sort((a, b) => counts[b] - counts[a]).map(k => [k, TNAME[k] || k, counts[k]])];
    $('#chips').innerHTML = chips.map(([k, n, v]) => `<button type="button" data-f="${k}" class="${S.filter === k ? 'on' : ''}">${esc(n)}<small>${v}</small></button>`).join('');
    const list = visible().slice().sort((a, b) => (LW[b.level] - LW[a.level]) || (new Date(b.from) - new Date(a.from))), N = S.showAll ? list.length : 12;
    $('#alerts').innerHTML = list.slice(0, N).map(e => `<li data-id="${esc(e.id)}"><span class="ic" style="color:${LV[e.level]}">${esc(GLYPH[e.code] || '*')}</span><span class="t"><b>${esc(e.name)}</b><small>${esc([e.country, e.severity, ago(e.from)].filter(Boolean).join(' · '))}</small></span><span class="lv ${esc(e.level)}">${esc(e.level)}</span><a href="${esc(e.url)}" target="_blank" rel="noopener">report ↗</a></li>`).join('');
    $('#moreBtn').hidden = list.length <= 12; $('#moreBtn').textContent = S.showAll ? 'show fewer' : `show all ${list.length}`;
    M.draw(); }
  $('#chips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.filter = b.dataset.f; S.showAll = false; paintAlerts(); say(`showing ${b.textContent}`); });
  $('#moreBtn').addEventListener('click', () => { S.showAll = !S.showAll; paintAlerts(); });
  $('#alerts').addEventListener('pointerover', e => { const li = e.target.closest('li'); if (li) setHL(li.dataset.id); });
  $('#alerts').addEventListener('pointerleave', () => setHL(null));

  async function loadWorld() {
    const st = $('#worldSt');
    try { const w = await jget('/api/x?a=world', 15000); if (!w.ok || !w.events.length) throw new Error(w.error || 'empty');
      S.events = w.events; const red = w.events.filter(e => e.level === 'red').length, orange = w.events.filter(e => e.level === 'orange').length;
      st.className = 'st live'; st.querySelector('span').textContent = `${w.src} · ${w.events.length} alerts · ${red} red · ${orange} orange · read ${ago(w.at)}`;
      $('#srcLine').textContent = w.note || ''; $('#worldOff').hidden = true;
      $('#gcapTxt').textContent = `live · ${w.events.length} disaster alerts on earth right now · drag to turn`;
      paintAlerts();
    } catch (e) {
      st.className = 'st off'; st.querySelector('span').textContent = 'feed offline'; $('#worldOff').hidden = false; $('#alerts').innerHTML = ''; $('#chips').innerHTML = '';
      $('#gcapTxt').textContent = 'the alert feed is offline · drag to turn'; }
  }
  $('#worldRetry').addEventListener('click', () => { $('#worldSt').querySelector('span').textContent = 'reading GDACS…'; $('#worldSt').className = 'st'; loadWorld(); });

  // ---------------------------------------------------------------- the calculator: pump.fun's published creator fees, to the decimal
  const CURVE = { creator: .30, protocol: .95, lp: 0, total: 1.25 };
  const TIERS = [[0, 420, .300, .930, .020], [420, 1470, .950, .050, .200], [1470, 2460, .900, .050, .200], [2460, 3440, .850, .050, .200], [3440, 4420, .800, .050, .200], [4420, 9820, .750, .050, .200], [9820, 14740, .700, .050, .200],
    [14740, 19650, .650, .050, .200], [19650, 24560, .600, .050, .200], [24560, 29470, .550, .050, .200], [29470, 34380, .500, .050, .200], [34380, 39300, .450, .050, .200], [39300, 44210, .400, .050, .200], [44210, 49120, .350, .050, .200],
    [49120, 54030, .300, .050, .200], [54030, 58940, .275, .050, .200], [58940, 63860, .250, .050, .200], [63860, 68770, .225, .050, .200], [68770, 73681, .200, .050, .200], [73681, 78590, .175, .050, .200], [78590, 83500, .150, .050, .200],
    [83500, 88400, .125, .050, .200], [88400, 93330, .100, .050, .200], [93330, 98240, .075, .050, .200], [98240, Infinity, .050, .050, .200]];
  let venue = 'curve';
  const num = s => { const v = parseFloat(String(s || '').replace(/[, _$]/g, '')); return isFinite(v) ? v : NaN; };
  const pct = v => (+v).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + '%';
  function paintTiers(active) {
    const rows = [`<tr class="sep"><td colspan="2">bonding curve</td></tr>`, `<tr data-i="curve" class="${active === 'curve' ? 'on' : ''}"><td>until graduation</td><td>${pct(CURVE.creator)}</td></tr>`, `<tr class="sep"><td colspan="2">PumpSwap · market cap in SOL</td></tr>`,
      ...TIERS.map((t, i) => `<tr data-i="${i}" class="${active === i ? 'on' : ''}"><td>${t[1] === Infinity ? t[0].toLocaleString('en-US') + ' and up' : t[0].toLocaleString('en-US') + ' – ' + t[1].toLocaleString('en-US')}</td><td>${pct(t[2])}</td></tr>`)];
    $('#tiers').innerHTML = `<table><thead><tr><th>where</th><th style="text-align:right">to the kitchen</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
    const on = $('#tiers tr.on'); if (on) { const box = $('#tiers'); box.scrollTop = Math.max(0, on.offsetTop - box.clientHeight / 2); } }
  function calc() {
    const size = num($('#cSize').value), out = $('#cOut'), why = $('#cWhy');
    if ($('#cSize').value.trim() === '') { out.className = 'out dim'; out.textContent = 'type a trade size'; why.textContent = "the fee is worked out exactly from pump.fun's published table."; paintTiers(venue === 'curve' ? 'curve' : null); return; }
    if (!(size > 0)) { out.className = 'out dim'; out.textContent = 'that is not a trade size'; why.textContent = 'use a positive number of SOL, like 0.5 or 2.'; return; }
    if (size > 1e6) { out.className = 'out dim'; out.textContent = 'that trade is bigger than the pool'; why.textContent = 'try something under a million SOL.'; return; }
    let rate, label, idx;
    if (venue === 'curve') { rate = CURVE.creator; idx = 'curve'; label = 'on the bonding curve the creator fee is a flat 0.3%'; }
    else { const capUsd = num($('#cCap').value);
      if ($('#cCap').value.trim() === '') { out.className = 'out dim'; out.textContent = 'add the market cap'; why.textContent = 'PumpSwap fees depend on the market cap, in SOL.'; paintTiers(null); return; }
      if (!(capUsd > 0)) { out.className = 'out dim'; out.textContent = 'that is not a market cap'; why.textContent = 'use a positive number of dollars, like 250000.'; return; }
      if (!S.solUsd) { out.className = 'out dim'; out.textContent = 'waiting for the SOL price'; why.textContent = 'the tier is set in SOL, so the dollar figure needs a live SOL price.'; return; }
      const capSol = capUsd / S.solUsd; idx = TIERS.findIndex(t => capSol >= t[0] && capSol < t[1]); const t = TIERS[idx]; rate = t[2];
      label = `$${Math.round(capUsd).toLocaleString('en-US')} is ${Math.round(capSol).toLocaleString('en-US')} SOL of market cap at $${S.solUsd.toFixed(2)} a SOL, which is the ${t[1] === Infinity ? t[0].toLocaleString('en-US') + '+' : t[0].toLocaleString('en-US') + '–' + t[1].toLocaleString('en-US')} SOL tier: ${pct(rate)}`; }
    const fee = size * rate / 100, feeUsd = S.solUsd ? fee * S.solUsd : null;
    out.className = 'out'; out.innerHTML = `${esc(sol(fee))}${feeUsd != null ? ` <em>≈ ${esc(usd(feeUsd))}</em>` : ''}`;
    why.textContent = `${size.toLocaleString('en-US', { maximumFractionDigits: 6 })} SOL × ${pct(rate)} = ${fee.toFixed(9).replace(/0+$/, '').replace(/\.$/, '')} SOL to the kitchen. ${label}.`;
    paintTiers(idx); say(out.textContent); }
  $('#cSize').addEventListener('input', calc); $('#cCap').addEventListener('input', calc);
  $('#cVenue').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; venue = b.dataset.v; $$('#cVenue button').forEach(x => x.classList.toggle('on', x === b)); $('#cCapRow').hidden = venue !== 'swap'; calc(); });
  paintTiers('curve');

  // ---------------------------------------------------------------- config, the vault and the ledger
  async function loadCfg() {
    try { const c = await jget('/api/x?a=cfg'); S.cfg = c; S.solUsd = c.sol || null; } catch { S.cfg = { ca: '', x: '', vault: '', cadence: 'daily' }; }
    const c = S.cfg, ss = $('#solSt');
    if (S.solUsd) { ss.className = 'st live'; ss.querySelector('span').textContent = `SOL ${usd(S.solUsd)} · live`; } else { ss.className = 'st off'; ss.querySelector('span').textContent = 'SOL price offline: the curve still works'; }
    if (c.ca) { $('#strip').querySelector('.wrap').innerHTML = `<i></i><span>official token $WORLD</span><code>${esc(c.ca)}</code><button type="button" id="copyCa">copy</button><span>anything else is not ours.</span>`;
      $('#copyCa').addEventListener('click', () => navigator.clipboard.writeText(c.ca).then(() => toast('contract address copied'), () => toast('copy failed: select it by hand')));
      const buy = `https://pump.fun/coin/${encodeURIComponent(c.ca)}`; for (const id of ['#navBuy', '#heroBuy']) { $(id).href = buy; $(id).hidden = false; } $('#heroRule').classList.remove('solid'); }
    if (c.x) { const u = /^https?:/.test(c.x) ? c.x : `https://x.com/${c.x.replace(/^@/, '')}`; $('#navX').href = u; $('#navX').hidden = false; }
    const cad = c.cadence === 'hourly' ? 'every hour' : 'at least once a day'; $('#cadTxt').textContent = cad;
    $('#faqCad').textContent = `${cad[0].toUpperCase() + cad.slice(1)}, the whole balance minus a few cents of network fees. Small balances may wait until they're worth more than the cost of sending them.`;
    calc();
  }
  async function loadVault() {
    let v; try { v = await jget('/api/x?a=vault', 20000); } catch { return; }
    if (v.sol) { S.solUsd = v.sol; }
    if (v.coin && v.coin.listed) { $('#nTrade').innerHTML = `${esc(usd(v.coin.vol24))} traded in 24h<small>market cap ${esc(usd(v.coin.mcap))} · <a href="${esc(v.coin.url)}" target="_blank" rel="noopener">chart ↗</a></small>`; }
    else if (v.coin && v.coin.listed === false) { $('#nTrade').innerHTML = `on the bonding curve<small><a href="https://pump.fun/coin/${esc(v.coin.ca)}" target="_blank" rel="noopener">see it on pump.fun ↗</a></small>`; }
    if (!v.open || !v.vault) return;
    const a = v.vault, rs = $('#routeSt'), ls = $('#ledgerSt');
    if (a.error) { rs.className = ls.className = 'st off'; rs.querySelector('span').textContent = ls.querySelector('span').textContent = a.error; return; }
    const px = S.solUsd, link = `https://solscan.io/account/${a.address}`;
    rs.className = ls.className = 'st live'; rs.querySelector('span').textContent = ls.querySelector('span').textContent = `vault ${short(a.address)} · read live`;
    $('#nVault').innerHTML = `${esc(sol(a.balance))}${px ? ` · ${esc(usd(a.balance * px))}` : ''}<small><a href="${link}" target="_blank" rel="noopener">${esc(short(a.address))} on Solscan ↗</a></small>`;
    $('#nOut').innerHTML = a.out.length ? `${esc(sol(a.totalOut))} sent<small>${a.out.length} send${a.out.length === 1 ? '' : 's'} · last ${esc(ago(a.out[0].t))}</small>` : `nothing sent yet<small>the first send will be listed in plate 06</small>`;
    $('#ledgerClosed').hidden = true; $('#ledgerOpen').hidden = false;
    $('#lBal').innerHTML = `${esc(sol(a.balance))}<small>${px ? esc(usd(a.balance * px)) : ''}</small>`;
    $('#lOut').innerHTML = `${esc(sol(a.totalOut))}<small>${px ? '≈ ' + esc(usd(a.totalOut * px)) + ' at today\'s price' : ''}</small>`;
    $('#lCount').innerHTML = `${a.out.length}<small>${a.out.length ? 'last ' + esc(ago(a.out[0].t)) : 'none yet'}</small>`;
    $('#lIn').innerHTML = `${esc(sol(a.totalIn))}<small>in the last ${a.seen} transactions</small>`;
    $('#lRows').innerHTML = a.out.length ? a.out.map(o => `<tr><td>${o.t ? esc(new Date(o.t).toISOString().slice(0, 16).replace('T', ' ')) + ' UTC' : '—'}</td><td class="m">${esc(sol(o.sol))}</td><td class="m">${esc(o.to || '—')}</td><td class="m"><a href="https://solscan.io/tx/${esc(o.sig)}" target="_blank" rel="noopener">tx ↗</a> ${o.receipt ? `· <a href="${esc(o.receipt)}" target="_blank" rel="noopener">receipt ↗</a>` : '<span class="warn">· no receipt yet</span>'}</td></tr>`).join('')
      : `<tr><td colspan="4">No sends yet. The first one will be listed here with its transaction.</td></tr>`;
    $('#lNote').innerHTML = `Read from the last ${a.seen} transactions of <a href="${link}" target="_blank" rel="noopener">${esc(a.address)} ↗</a>. Every SOL that left the vault is listed; sends are marked "no receipt yet" until a Giving Block receipt is attached.`;
  }

  // ---------------------------------------------------------------- reveal, scroll-spy, hero
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach(el => io.observe(el));
  const sweep = () => $$('.rv:not(.vis)').forEach(el => { if (el.getBoundingClientRect().top < innerHeight * .95) el.classList.add('vis'); });
  addEventListener('scroll', sweep, { passive: true }); addEventListener('hashchange', () => setTimeout(sweep, 60));
  const links = $$('#links a').filter(a => a.getAttribute('href').startsWith('#')), secs = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  const spy = () => { let cur = null; for (const s of secs) if (s.getBoundingClientRect().top < 140) cur = s.id; links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + cur)); };
  addEventListener('scroll', spy, { passive: true }); spy();
  requestAnimationFrame(() => { const ws = $$('#h1 .w'); ws.forEach((w, i) => w.style.transitionDelay = (120 + i * 90) + 'ms'); $('.hero').classList.add('go'); });

  loadCfg().then(loadVault); loadWorld();
  setInterval(loadWorld, 10 * 60 * 1000); setInterval(loadVault, 60 * 1000);
})();
