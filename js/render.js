'use strict';
/* Scene drawing into the colour + data canvases, then the lighting pass */
function spr(s, x, y, o = {}) {   // o: flip, z, sy, white, alpha
  const hh = Math.max(1, Math.round(s.h * (o.sy || 1))), dx = Math.round(x - cam.x - s.w / 2), dy = Math.round(y - cam.y - (o.z || 0)) + 2 - hh;
  const draw = (c, img) => {
    if (o.flip) { c.save(); c.translate(dx + s.w, dy); c.scale(-1, 1); c.drawImage(img, 0, 0, s.w, s.h, 0, 0, s.w, hh); c.restore(); }
    else c.drawImage(img, 0, 0, s.w, s.h, dx, dy, s.w, hh);
  };
  if (o.alpha !== undefined) ac.globalAlpha = o.alpha;
  draw(ac, o.white ? s.W : s.A); ac.globalAlpha = 1;
  draw(dc, o.white ? s.E : s.D);
}
function sprRot(s, x, y, ang) {
  for (const [c, img] of [[ac, s.A], [dc, s.D]]) { c.save(); c.translate(Math.round(x - cam.x), Math.round(y - cam.y)); c.rotate(ang); c.drawImage(img, -3, -s.h / 2); c.restore(); }
}
// A pixel floating z above the ground; em 255 = self-lit, 0 = lit by the scene.
function dot(x, y, z, col, size = 1, em = 255) {
  const sx = Math.round(x - cam.x - size / 2), sy = Math.round(y - cam.y - z - size / 2);
  ac.fillStyle = col; ac.fillRect(sx, sy, size, size);
  dc.fillStyle = `rgb(${clamp(Math.round(z), 0, 31) * 8},${K_SPR},${em})`; dc.fillRect(sx, sy, size, size);
}
// A flat mark on the floor.
function fdot(x, y, w, h, col, em = 0) {
  const sx = Math.round(x - cam.x), sy = Math.round(y - cam.y);
  ac.fillStyle = col; ac.fillRect(sx, sy, w, h);
  if (em) { dc.fillStyle = `rgb(0,${K_FLOOR},${em})`; dc.fillRect(sx, sy, w, h); }
}
function shadow(x, y, w = 8, a = 0.4) {
  const sx = Math.round(x - cam.x), sy = Math.round(y - cam.y);
  ac.fillStyle = `rgba(0,0,6,${a})`; ac.fillRect(sx - w / 2, sy, w, 3); ac.fillRect(sx - w / 2 + 1, sy - 1, w - 2, 5);
}
const visible = (x, y) => x > cam.x - 24 && x < cam.x + VW + 24 && y > cam.y - 12 && y < cam.y + VH + 44;

function drawStairs() {
  const st = LV.stairs; if (!visible(st.x, st.y)) return;
  const x = st.x - 8, y = st.y - 8, B = LV.B;
  fdot(x - 1, y - 1, 18, 18, rgb(B.floor, 1.3));
  for (let i = 0; i < 4; i++) { fdot(x, y + i * 4, 16, 4, rgb(B.floor, 0.16 + i * 0.17)); fdot(x, y + i * 4 + 3, 16, 1, rgb(B.floor, 0.34 + i * 0.2)); }
  const pulse = Math.round(150 + Math.sin(G.time * 3) * 70);
  if (!st.open) {   // seal: a glowing rune cross
    for (let i = 2; i < 14; i++) { fdot(x + i, y + i, 1, 1, '#ff4030', pulse); fdot(x + 15 - i, y + i, 1, 1, '#ff4030', pulse); }
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + G.time * 0.5; fdot(st.x + Math.cos(a) * 10, st.y + Math.sin(a) * 10, 1, 1, '#ff7040', pulse); }
  } else for (let k = 0; k < 20; k++) { const a = k / 20 * TAU - G.time * 1.6; fdot(st.x + Math.cos(a) * 10, st.y + Math.sin(a) * 10, 1, 1, k % 2 ? '#c080ff' : '#80d0ff', 255); }
}
function drawHero() {
  const back = Math.sin(pl.ang) < -0.5, flip = Math.cos(pl.ang) < 0, moving = pl.walk > 0;
  const fr = moving ? 1 + (Math.floor(pl.walk) % 2) : 0, bob = moving ? Math.abs(Math.sin(pl.walk * Math.PI)) * 1.3 : Math.sin(G.time * 2.5) * 0.4;
  const s = (back ? S.hero.back : S.hero.front)[fr];
  let a = pl.ang + 0.9 * (flip ? -1 : 1);   // resting grip
  if (pl.swing > 0) { const p = 1 - pl.swing / pl.swingMax; a = pl.swingA + pl.swingDir * (p * 2.6 - 1.3); }
  const sword = () => sprRot(S.sword, pl.x + Math.cos(a) * 3, pl.y - 6 - bob + Math.sin(a) * 2, a);
  if (back) sword();
  spr(s, pl.x, pl.y, { flip, z: bob });
  if (!back) sword();
  const t = G.time * 2.2;   // the Spark: an ember that orbits its bearer
  dot(pl.x + Math.cos(t) * 10, pl.y + Math.sin(t) * 4, 15 + Math.sin(t * 1.7) * 2, '#fff0c0', 2);
  dot(pl.x + Math.cos(t - 0.35) * 10, pl.y + Math.sin(t - 0.35) * 4, 15 + Math.sin((t - 0.35) * 1.7) * 2, '#ffa040', 1);
}
function drawEnemy(e) {
  const white = e.flash > 0, t = G.time;
  if (e.type === 'slime') { const sq = e.z > 0 ? 1.12 : 1 + Math.sin(t * 6 + e.ph) * 0.1; spr(S.slime[LV.bi], e.x, e.y, { z: e.z, sy: sq, white }); }
  else if (e.type === 'bat') spr(S.bat[Math.floor(t * 9 + e.ph) % 2], e.x, e.y, { z: 9 + Math.sin(t * 6 + e.ph) * 2, white });
  else if (e.type === 'skel') {
    const tele = e.state === 'wind' && Math.floor(t * 20) % 2;
    spr(S.skel, e.x, e.y, { flip: pl.x < e.x, z: e.awake ? Math.abs(Math.sin(t * 8 + e.ph)) * 1.2 : 0, white: white || tele });
  } else if (e.type === 'cult') {
    spr(S.cult, e.x, e.y, { flip: pl.x < e.x, z: Math.sin(t * 2 + e.ph) * 0.6, white });
    if (e.state === 'cast') { const g = e.st / 0.6; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + t * 6; dot(e.x + Math.cos(a) * (8 - g * 6), e.y + Math.sin(a) * (4 - g * 3), 20, '#ff60e8', 1); } dot(e.x, e.y, 20, '#ffd0ff', 1 + Math.round(g * 2)); }
  } else if (e.type === 'wraith') spr(S.wraith, e.x, e.y, { flip: pl.x < e.x, z: 4 + Math.sin(t * 3 + e.ph) * 1.5, alpha: e.phased ? 0.22 : 0.8, white });
  else if (e.type === 'boss') {
    const tele = e.state === 'charge' && e.st < 0.7 && Math.floor(t * 16) % 2;
    spr(S.boss, e.x, e.y + 4, { z: G.bossAwake ? Math.abs(Math.sin(t * 3)) * 1.5 : 0, white: white || tele });
  }
  if (e.elite) for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + t * 2.5; dot(e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 5, 3 + (k % 2) * 8, '#ffd24a', 1); }
}
function drawSlash(s) {
  const p = s.t / s.max, a0 = s.ang - s.dir * s.arc, sweep = Math.min(1, p * 1.7) * 2 * s.arc, tail = Math.max(0, p * 1.7 - 0.7) * 2 * s.arc, n = s.heavy ? 26 : 18;
  for (let i = 0; i <= n; i++) {
    const u = i / n * 2 * s.arc; if (u > sweep || u < tail) continue;
    const a = a0 + s.dir * u, edge = (u - tail) / Math.max(0.01, sweep - tail);
    for (let r = s.range * 0.62; r <= s.range; r += 3) dot(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 7, edge > 0.7 ? '#ffffff' : edge > 0.35 ? '#ffd890' : '#ff9040', edge > 0.5 ? 2 : 1);
  }
}

const LP = new Float32Array(NL * 3), LC = new Float32Array(NL * 3);
function renderScene() {
  const B = LV.B, t = G.time;
  cam.x = Math.round(clamp(cam.fx + (Math.random() - 0.5) * G.shake, 0, MW * TS - VW));
  cam.y = Math.round(clamp(cam.fy + (Math.random() - 0.5) * G.shake, 0, MH * TS - VH));
  ac.drawImage(LV.floorA, cam.x, cam.y, VW, VH, 0, 0, VW, VH);
  dc.drawImage(LV.floorD, cam.x, cam.y, VW, VH, 0, 0, VW, VH);

  // floor-level marks
  drawStairs();
  for (const s of LV.spikes) { const x = s.tx * TS, y = s.ty * TS; if (!visible(x, y)) continue; for (const i of [3, 8, 13]) for (const j of [4, 10]) fdot(x + i - 1, y + j, 2, 2, '#14121a'); if (s.warn) for (const i of [3, 8, 13]) for (const j of [4, 10]) fdot(x + i - 1, y + j - 1, 2, 1, '#c8d0e0'); }
  for (const b of LV.braziers) if (b.lit && visible(b.x, b.y)) for (let k = 0; k < 24; k++) { const a = k / 24 * TAU + t * 0.4; fdot(b.x + Math.cos(a) * 13, b.y + Math.sin(a) * 13, 1, 1, '#ffb050', Math.round(140 + Math.sin(t * 2 + k) * 80)); }
  for (const f of flashes) if (f.ring) { const r = 2 + f.t / f.max * 9, al = 0.5 * (1 - f.t / f.max); for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; fdot(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.6, 1, 1, `rgba(200,230,255,${al})`); } }
  for (const n of novas) { const r = 8 + n.t / 0.45 * 62; for (let k = 0; k < 64; k++) { const a = k / 64 * TAU; fdot(n.x + Math.cos(a) * r, n.y + Math.sin(a) * r, 2, 2, k % 2 ? '#ffe080' : '#ff8030', 255); } }

  // depth-sorted sprites
  const list = [], add = (y, f) => list.push([y, f]);
  const fb = LV.bi;
  for (const tc of LV.torches) if (visible(tc.x, tc.y)) add(tc.y, () => { spr(S.bracket, tc.x, tc.y, { z: 5 }); spr(S.flame[fb][Math.floor(t * 9 + tc.ph) % 4], tc.x, tc.y, { z: 10 }); });
  for (const b of LV.braziers) if (visible(b.x, b.y)) { shadow(b.x, b.y + 3, 12); add(b.y + 3, () => { spr(b.lit ? S.brazOn : S.brazOff, b.x, b.y + 3); if (b.lit && b.t > 0) spr(S.flameBig[Math.floor(t * 9 + b.x) % 4], b.x, b.y + 3, { z: 8, sy: Math.min(1, b.t * 2.5) }); }); }
  for (const p of LV.props) if (!p.dead && visible(p.x, p.y)) { shadow(p.x, p.y + 2, 10, 0.34); add(p.y + 2, () => spr(p.kind === 'chest' ? (p.open ? S.chestO : S.chestC) : S[p.kind], p.x, p.y + 2)); }
  for (const s of LV.spikes) if (s.up && visible(s.tx * TS, s.ty * TS)) add(s.ty * TS + 12, () => { spr(S.spikes, s.tx * TS + 8, s.ty * TS + 6); spr(S.spikes, s.tx * TS + 8, s.ty * TS + 12); });
  for (const p of pickups) if (visible(p.x, p.y)) {
    if (p.type === 'xp') { add(p.y, () => { dot(p.x, p.y, p.z + 3, '#a0ff90', 2); dot(p.x, p.y, p.z + 3, '#ffffff', 1); }); continue; }
    shadow(p.x, p.y, 6, 0.3);
    add(p.y, () => spr(p.type === 'coin' ? S.coin[Math.floor(t * 8 + p.x) % 4 === 1 ? 1 : 0] : S[p.type], p.x, p.y, { z: p.z + 1 + Math.sin(t * 4 + p.x) * 0.8 }));
  }
  for (const e of enemies) if (visible(e.x, e.y)) { shadow(e.x, e.y, e.type === 'boss' ? 24 : e.def.fly ? 6 : 10, e.phased ? 0.12 : 0.4); add(e.y, () => drawEnemy(e)); }
  for (const b of bolts) add(b.y, () => { dot(b.x, b.y, 7, b.mine ? '#fff0b0' : '#ffc0ff', 3); dot(b.x - b.vx * 0.016, b.y - b.vy * 0.016, 7, b.mine ? '#ff8030' : '#d040d0', 2); });
  if (!G.menuMode && !pl.dead) { shadow(pl.x, pl.y, 10); if (!(pl.inv > 0 && Math.floor(t * 20) % 2)) add(pl.y, drawHero); }
  for (const s of slashes) add(s.y + 6, () => drawSlash(s));
  list.sort((p, q) => p[0] - q[0]);

  // Walls and sprites interleaved row by row so tall walls hide what stands behind them.
  let li = 0;
  const r0 = Math.max(0, Math.floor(cam.y / TS) - 1), r1 = Math.min(MH - 1, Math.floor((cam.y + VH + WALL_H) / TS));
  for (let r = r0; r <= r1; r++) {
    const sy = r * TS - WALL_H - cam.y;
    ac.drawImage(LV.rowA[r], cam.x, 0, VW, TS + WALL_H, 0, sy, VW, TS + WALL_H);
    dc.drawImage(LV.rowD[r], cam.x, 0, VW, TS + WALL_H, 0, sy, VW, TS + WALL_H);
    while (li < list.length && list[li][0] < (r + 1) * TS) list[li++][1]();
  }
  while (li < list.length) list[li++][1]();
  for (const p of parts) dot(p.x, p.y, p.z, p.col, p.life < 0.12 ? 1 : p.size, p.em);
  for (const m of motes) { const mx = ((m.x - cam.x * 0.9) % VW + VW) % VW, my = ((m.y - cam.y * 0.9) % (VH + 30) + VH + 30) % (VH + 30); dot(cam.x + mx, cam.y + my, m.z, '#c8c0b0', 1, 0); }

  // lights: [x, y, radius, r, g, b]
  const L = [], fl = (ph, s) => 1 + Math.sin(t * 13 + ph) * 0.04 * s + Math.sin(t * 7.3 + ph * 2) * 0.03 * s;
  const tcz = B.torch;
  if (!G.menuMode && !pl.dead) L.push([pl.x, pl.y - 1, 104 * pl.lightK * fl(0, 1), 1, 0.85, 0.64, -1e9]);
  for (const tc of LV.torches) L.push([tc.x, tc.y + 3, 88 * fl(tc.ph, 1.6), tcz[0], tcz[1], tcz[2]]);
  for (const b of LV.braziers) if (b.lit && b.t > 0) { const g = Math.min(1, b.t * 2); L.push([b.x, b.y + 2, 140 * g * fl(b.x, 1.2), 1.15, 0.72, 0.32]); }
  for (const g of LV.glows) L.push([g.x, g.y, g.r * (1 + Math.sin(t * 2 + g.x) * 0.08), g.c[0], g.c[1], g.c[2]]);
  for (const b of bolts) L.push(b.mine ? [b.x, b.y, 50, 1, 0.55, 0.18] : [b.x, b.y, 38, 0.9, 0.2, 0.85]);
  for (const f of flashes) if (!f.ring) { const k = 1 - f.t / f.max; L.push([f.x, f.y, f.r * (0.6 + 0.4 * k), f.col[0] * k * 1.6, f.col[1] * k * 1.6, f.col[2] * k * 1.6]); }
  for (const e of enemies) {
    if (e.type === 'boss') L.push([e.x, e.y, 90, 1, 0.4, 0.12]);
    else if (e.type === 'wraith' && !e.phased) L.push([e.x, e.y, 34, 0.2, 0.6, 0.6]);
    else if (e.type === 'cult' && e.state === 'cast') L.push([e.x, e.y, 44, 0.9, 0.2, 0.8]);
    else if (e.type === 'slime' && LV.bi === 2) L.push([e.x, e.y, 30, 0.8, 0.3, 0.08]);
    else if (e.elite) L.push([e.x, e.y, 36, 0.8, 0.6, 0.15]);
  }
  for (const p of pickups) if (p.type !== 'xp' && p.type !== 'coin') L.push([p.x, p.y, 22, p.type === 'mana' ? 0.2 : 0.8, 0.25, p.type === 'mana' ? 0.9 : 0.3]);
  const st = LV.stairs; L.push(st.open ? [st.x, st.y, 76 + Math.sin(t * 4) * 6, 0.6, 0.4, 1] : [st.x, st.y, 34, 0.8, 0.15, 0.1]);
  const cx = cam.x + VW / 2, cy = cam.y + VH / 2;
  const near = L.filter(l => Math.abs(l[0] - cx) < VW / 2 + l[2] && Math.abs(l[1] - cy) < VH / 2 + l[2] + 16)
    .map(l => [l, l[6] !== undefined ? l[6] : Math.hypot(l[0] - cx, l[1] - cy) - l[2] * 0.5]).sort((p, q) => p[1] - q[1]).slice(0, NL);
  LP.fill(0); LC.fill(0);
  near.forEach(([l], i) => { LP[i * 3] = l[0]; LP[i * 3 + 1] = l[1]; LP[i * 3 + 2] = l[2]; LC[i * 3] = l[3]; LC[i * 3 + 1] = l[4]; LC[i * 3 + 2] = l[5]; });

  const low = G.menuMode || pl.dead ? 0 : clamp(1 - pl.hp / (pl.maxHp * 0.35), 0, 1);
  gfxRender({ cam, LP, LC, amb: G.menuMode ? B.amb.map(v => v * 1.5) : B.amb, abyss: B.abyss, grade: B.grade, time: t, hurt: G.hurtFx, fade: G.fade, low, ab: G.hurtFx * 1.5 + G.flash * 2, flash: G.flash });
}
