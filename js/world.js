'use strict';
/* Level generation and baking of the static floor / wall layers */
// tiles: 0 floor, 1 wall, 2 water, 3 pit, 4 lava
let LV = null, levelSeq = 0;
const biomeOf = depth => { const c = (depth - 1) % 6; return c < 2 ? 0 : c < 4 ? 1 : 2; };
const isBossDepth = depth => depth % 6 === 0;
const tileAt = (tx, ty) => tx < 0 || ty < 0 || tx >= MW || ty >= MH ? 1 : LV.map[ty * MW + tx];
const wallT = (tx, ty) => tileAt(tx, ty) === 1;
const tileAtPx = (x, y) => tileAt(Math.floor(x / TS), Math.floor(y / TS));
const wallAt = (x, y) => tileAtPx(x, y) === 1;
// Walkers are stopped by walls and pits; flyers and projectiles only by walls.
function blocked(x, y, fly) {
  for (const [ox, oy] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) { const t = tileAtPx(x + ox, y + oy); if (t === 1 || (!fly && t === 3)) return true; }
  return false;
}
function los(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 5);
  for (let i = 1; i < n; i++) { const t = i / n; if (wallAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
  return true;
}
// Breadth-first distances over walkable tiles from a tile.
function flood(lv, tx, ty) {
  const D = new Int16Array(MW * MH).fill(-1), q = [ty * MW + tx]; D[q[0]] = 0;
  for (let i = 0; i < q.length; i++) for (const o of [-1, 1, -MW, MW]) { const n = q[i] + o, t = lv.map[n]; if (t !== 1 && t !== 3 && D[n] < 0) { D[n] = D[q[i]] + 1; q.push(n); } }
  return D;
}

function genLevel(depth, sd) {
  seed = sd | 0;
  const bi = biomeOf(depth);
  const lv = LV = { depth, bi, B: BIOMES[bi], boss: isBossDepth(depth), id: ++levelSeq, map: new Uint8Array(MW * MH).fill(1), style: new Uint8Array(MW * MH),
    rooms: [], torches: [], braziers: [], props: [], spikes: [], glows: [], spawns: [], decor: [], seen: new Uint8Array(MW * MH), used: new Set() };
  if (lv.boss) layoutBoss(lv); else layoutRooms(lv);
  placeTorches(lv);
  bakeLevel(lv);
  return lv;
}

function carveRoom(lv, r) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { lv.map[y * MW + x] = 0; lv.style[y * MW + x] = r.style; }
}
function corridor(lv, p, q) {   // 2-wide L corridor
  const cut = (x, y) => { const i = y * MW + x; if (lv.map[i] === 1) { lv.map[i] = 0; lv.style[i] = 1; } };
  for (let x = Math.min(p.cx, q.cx); x <= Math.max(p.cx, q.cx) + 1; x++) { cut(x, p.cy); cut(x, p.cy + 1); }
  for (let y = Math.min(p.cy, q.cy); y <= Math.max(p.cy, q.cy) + 1; y++) { cut(q.cx, y); cut(q.cx + 1, y); }
}
const tilePos = (tx, ty) => ({ tx, ty, x: tx * TS + 8, y: ty * TS + 8 });
// Picks an unused, reachable floor tile in a room. o: inset, edge (hug the walls), lanes (allow corridor lanes)
function freeTile(lv, r, o = {}) {
  const inset = o.inset || 0;
  for (let k = 0; k < 50; k++) {
    let tx = r.x + inset + ri(r.w - inset * 2), ty = r.y + inset + ri(Math.max(1, r.h - 1 - inset * 2));   // never the bottom row: it is hidden behind the south wall
    if (o.edge) { const s = ri(3); if (s === 0) ty = r.y; else tx = s === 1 ? r.x : r.x + r.w - 1; }
    const i = ty * MW + tx;
    if (lv.map[i] !== 0 || lv.used.has(i) || lv.dist[i] < 0) continue;
    if (!o.lanes && (tx === r.cx || tx === r.cx + 1 || ty === r.cy || ty === r.cy + 1)) continue;
    lv.used.add(i); return tilePos(tx, ty);
  }
  return null;
}
// Applies a terrain feature only if every room stays reachable.
function tryFeature(lv, cells, t) {
  const old = cells.map(i => lv.map[i]);
  cells.forEach(i => { lv.map[i] = t; });
  const D = flood(lv, lv.rooms[0].cx, lv.rooms[0].cy);
  if (lv.rooms.every(r => D[r.cy * MW + r.cx] >= 0 && D[(r.cy + 1) * MW + r.cx + 1] >= 0)) return true;
  cells.forEach((i, k) => { lv.map[i] = old[k]; });
  return false;
}
function blobCells(lv, r, rad, strict) {
  const m = strict ? 1 : 0, bx = r.x + 1 + rnd() * (r.w - 2), by = r.y + 1 + rnd() * (r.h - 2), cells = [];
  for (let y = r.y + m; y < r.y + r.h - m; y++) for (let x = r.x + m; x < r.x + r.w - m; x++) {
    if (lv.map[y * MW + x] !== 0) continue;
    if (strict && (x === r.cx || x === r.cx + 1 || y === r.cy || y === r.cy + 1)) continue;
    if ((x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 < rad * rad) cells.push(y * MW + x);
  }
  return cells;
}
const enemyPool = depth => { const p = ['slime', 'slime', 'bat']; if (depth >= 2) p.push('skel', 'skel'); if (depth >= 3) p.push('cult'); if (depth >= 4) p.push('wraith', 'cult'); return p; };

function layoutRooms(lv) {
  const { rooms, depth, bi } = lv, want = 7 + Math.min(3, depth >> 1);
  for (let i = 0; i < 500 && rooms.length < want; i++) {
    const w = 6 + ri(6), h = 5 + ri(4), x = 2 + ri(MW - w - 4), y = 3 + ri(MH - h - 6);
    if (rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: 'normal', style: ri(2) });
  }
  rooms.sort((p, q) => p.cx - q.cx);
  rooms[0].type = 'start'; rooms[rooms.length - 1].type = 'exit';
  const mid = rooms.slice(1, -1);
  if (mid.length) { const t = pick(mid); t.type = 'treasure'; t.style = 2; }
  if (depth >= 2) { const c = mid.filter(r => r.type === 'normal'); if (c.length) { const t = pick(c); t.type = 'altar'; t.style = 2; } }
  rooms.forEach(r => carveRoom(lv, r));
  for (let i = 0; i + 1 < rooms.length; i++) corridor(lv, rooms[i], rooms[i + 1]);
  for (let k = 0; k < 2; k++) { const a = ri(rooms.length), b = ri(rooms.length); if (Math.abs(a - b) > 1) corridor(lv, rooms[a], rooms[b]); }

  for (const r of rooms) {   // terrain features
    if (r.type !== 'normal' && r.type !== 'exit') continue;
    if (r.w >= 8 && r.h >= 6 && rnd() < 0.45) tryFeature(lv, [[2, 2], [r.w - 3, 2], [2, r.h - 3], [r.w - 3, r.h - 3]].map(([i, j]) => (r.y + j) * MW + r.x + i), 1);
    if (r.type === 'exit') continue;
    if (r.w >= 7 && r.h >= 6 && rnd() < 0.4) { const c = blobCells(lv, r, 1.4 + rnd() * 1.2, true); if (c.length >= 2) tryFeature(lv, c, 3); }
    if (bi === 2) { if (rnd() < 0.6) { const c = blobCells(lv, r, 1.2 + rnd() * 1.2, true); if (c.length && tryFeature(lv, c, 4)) { const i = c[c.length >> 1]; lv.glows.push({ x: (i % MW) * TS + 8, y: Math.floor(i / MW) * TS + 8, r: 78, c: [1, 0.36, 0.08] }); } } }
    else if (rnd() < (bi === 1 ? 0.75 : 0.45)) tryFeature(lv, blobCells(lv, r, 1.3 + rnd() * 1.6, false), 2);
  }
  const s = rooms[0], e = rooms[rooms.length - 1];
  lv.start = tilePos(s.cx, s.cy);
  lv.dist = flood(lv, s.cx, s.cy);
  lv.stairs = Object.assign(tilePos(e.cx, e.cy), { open: false });
  for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]]) { lv.used.add((e.cy + j) * MW + e.cx + i); lv.used.add((s.cy + j) * MW + s.cx + i); }

  const others = rooms.slice(1).sort(() => rnd() - 0.5), nb = Math.min(others.length, 2 + Math.min(2, depth >> 1));
  for (let i = 0; i < others.length && lv.braziers.length < nb; i++) { const t = freeTile(lv, others[i], { inset: 1 }); if (t) lv.braziers.push({ x: t.x, y: t.y, lit: false, t: 0 }); }
  for (const r of rooms) {
    if (r.type === 'treasure' || (r.type === 'normal' && rnd() < 0.2)) { const t = freeTile(lv, r, { inset: 1 }); if (t) lv.props.push({ kind: 'chest', x: t.x, y: t.y, open: false, big: r.type === 'treasure' }); }
    if (r.type === 'altar') { const t = freeTile(lv, r, { inset: 2 }) || freeTile(lv, r, { inset: 1 }); if (t) lv.props.push({ kind: 'altar', x: t.x, y: t.y }); }
    for (let n = 2 + ri(4); n > 0; n--) { const t = freeTile(lv, r, { edge: true }); if (t) lv.props.push({ kind: pick(['barrel', 'barrel', 'crate', 'urn']), x: t.x + ri(5) - 2, y: t.y + ri(3) - 1 }); }
    if (depth >= 2 && r.type === 'normal' && rnd() < 0.45) {
      const t0 = freeTile(lv, r, { inset: 1, lanes: true });
      if (t0) for (let k = 0; k < 4; k++) { const i = t0.ty * MW + t0.tx + k; if (k === 0 || (lv.map[i] === 0 && !lv.used.has(i))) { lv.used.add(i); lv.spikes.push({ tx: t0.tx + k, ty: t0.ty, ph: k * 0.15 }); } else break; }
    }
    if (r.type === 'start') continue;
    const pool = enemyPool(depth);
    let n = 2 + ri(2) + Math.min(3, depth >> 1) + (r.type === 'exit' || r.type === 'treasure' ? 1 : 0);
    for (let tries = 0; n > 0 && tries < 60; tries++) {
      const tx = r.x + ri(r.w), ty = r.y + ri(r.h), t = lv.map[ty * MW + tx];
      if ((t !== 0 && t !== 2) || lv.dist[ty * MW + tx] < 0) continue;
      lv.spawns.push({ type: pick(pool), x: tx * TS + 8, y: ty * TS + 8, elite: depth >= 2 && rnd() < 0.1 }); n--;
    }
  }
}

function layoutBoss(lv) {
  const s = { x: 5, y: 16, w: 7, h: 5, cx: 8, cy: 18, type: 'start', style: 0 }, a = { x: 22, y: 12, w: 19, h: 13, cx: 31, cy: 18, type: 'arena', style: 2 };
  lv.rooms.push(s, a); carveRoom(lv, s); carveRoom(lv, a); corridor(lv, s, a);
  for (const [i, j] of [[4, 3], [14, 3], [4, 9], [14, 9]]) lv.map[(a.y + j) * MW + a.x + i] = 1;
  for (const [i, j] of [[1, 1], [a.w - 3, 1], [1, a.h - 3], [a.w - 3, a.h - 3]]) {
    for (let k = 0; k < 4; k++) lv.map[(a.y + j + (k >> 1)) * MW + a.x + i + (k & 1)] = lv.bi === 2 ? 4 : 2;
    if (lv.bi === 2) lv.glows.push({ x: (a.x + i + 1) * TS, y: (a.y + j + 1) * TS, r: 70, c: [1, 0.36, 0.08] });
  }
  lv.start = tilePos(s.cx, s.cy); lv.dist = flood(lv, s.cx, s.cy);
  lv.stairs = Object.assign(tilePos(a.x + a.w - 3, a.cy), { open: false });
  for (const [i, j] of [[7, 2], [11, 2], [7, 10], [11, 10]]) lv.braziers.push({ x: (a.x + i) * TS + 8, y: (a.y + j) * TS + 8, lit: false, t: 0, auto: true });
  lv.props.push({ kind: 'chest', x: (s.x + 1) * TS + 8, y: (s.y + 1) * TS + 8, open: false, big: true });
  for (const [i, j] of [[5, 0], [6, 1], [0, 3]]) lv.props.push({ kind: pick(['barrel', 'crate', 'urn']), x: (s.x + i) * TS + 8, y: (s.y + j) * TS + 8 });
  lv.spawns.push({ type: 'boss', x: a.cx * TS + 8, y: a.cy * TS + 8 });
}

function placeTorches(lv) {
  for (let ty = 2; ty < MH - 1; ty++) for (let tx = 1; tx < MW - 1; tx++) {
    const i = ty * MW + tx;
    if (lv.map[i] === 1 || lv.map[i - MW] !== 1) continue;   // need an open tile with a wall face above it
    const x = tx * TS + 8, y = ty * TS + 1;
    if (!lv.torches.some(t => Math.hypot(t.x - x, t.y - y) < 78) && rnd() < 0.5) lv.torches.push({ x, y, ph: rnd() * 9 });
    else if (rnd() < 0.22) lv.decor.push({ tx, ty: ty - 1, kind: pick(lv.B.decor) });
  }
}

function paintRug(fa, lv, r) {
  const x0 = (r.x + 2) * TS, y0 = (r.y + 1) * TS + 6, x1 = (r.x + r.w - 2) * TS, y1 = (r.y + r.h - 2) * TS - 2, B = lv.B;
  if (x1 - x0 < 40 || y1 - y0 < 24) return;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (lv.map[Math.floor(y / TS) * MW + Math.floor(x / TS)] !== 0) continue;
    const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y), u = (x - x0) % 12, v = (y - y0) % 12;
    let c = rgb(B.rug, 0.82 + hsh(x, y) * 0.22);
    if (e < 2) c = rgb(B.rug, 0.5); else if (e === 3) c = 'rgb(206,166,78)';
    else if (e > 5 && Math.abs(u - 6) + Math.abs(v - 6) === 3) c = 'rgb(206,166,78)';
    else if (e > 5 && Math.abs(u - 6) + Math.abs(v - 6) < 2) c = rgb(B.rug, 1.35);
    if ((x === x0 || x === x1 - 1) && y % 2) c = 'rgb(206,166,78)';
    fa.fillStyle = c; fa.fillRect(x, y, 1, 1);
  }
}

function decal(fa, fd, lv, x, y) {
  const B = lv.B, px = x * TS, py = y * TS, r = rnd(), north = wallT(x, y - 1), nearWall = north || wallT(x - 1, y) || wallT(x + 1, y);
  const dot = (dx, dy, col, w = 1, h = 1) => { fa.fillStyle = col; fa.fillRect(px + dx, py + dy, w, h); };
  const glow = (dx, dy, w = 1, h = 1) => { fd.fillStyle = `rgb(0,${K_FLOOR},255)`; fd.fillRect(px + dx, py + dy, w, h); };
  if (r < 0.07) { let cx = 2 + ri(12), cy = 2 + ri(8); for (let i = 7 + ri(6); i > 0; i--) { dot(cx, cy, 'rgba(0,0,0,0.5)'); cx = clamp(cx + ri(3) - 1, 0, 15); cy = clamp(cy + (rnd() < 0.6 ? 1 : 0), 0, 15); } }
  else if (r < 0.13) { for (let i = 2 + ri(3); i > 0; i--) { const dx = 1 + ri(13), dy = 1 + ri(13); dot(dx, dy + 1, 'rgba(0,0,0,0.45)', 2, 1); dot(dx, dy, rgb(B.floor, 1.4), 2, 1); } }
  else if (r < 0.155) { const dx = 2 + ri(8), dy = 3 + ri(9), c = 'rgb(214,206,186)'; dot(dx + 1, dy + 1, 'rgba(0,0,0,0.4)', 4, 1); dot(dx + 1, dy, c, 4, 1); dot(dx, dy - 1, c); dot(dx, dy + 1, c); dot(dx + 5, dy - 1, c); dot(dx + 5, dy + 1, c); }
  else if (r < 0.165) { const dx = 3 + ri(8), dy = 3 + ri(8), c = 'rgb(220,214,196)'; dot(dx, dy, c, 4, 3); dot(dx + 1, dy + 3, c, 2, 1); dot(dx + 1, dy + 1, '#221a2a'); dot(dx + 3, dy + 1, '#221a2a'); }
  else if (r < 0.185) { const dx = 4 + ri(7), dy = 4 + ri(7); fa.fillStyle = lv.bi === 2 ? 'rgba(16,8,8,0.45)' : 'rgba(96,10,22,0.38)'; for (let i = 0; i < 9; i++) fa.fillRect(px + dx + ri(5) - 2, py + dy + ri(4) - 2, 1 + ri(3), 1 + ri(2)); }
  else if (nearWall && r < 0.185 + [0.12, 0.34, 0][lv.bi]) { for (let i = 10 + ri(12); i > 0; i--) dot(ri(16), ri(north ? 7 : 16), rgb(B.moss, 0.7 + rnd() * 0.6)); }
  else if (lv.bi === 1 && r > 0.95) {   // glowing mushrooms
    for (let i = 2 + ri(2); i > 0; i--) { const dx = 2 + ri(11), dy = 3 + ri(10); dot(dx + 1, dy + 2, 'rgb(212,222,204)', 1, 2); dot(dx, dy, 'rgb(70,240,200)', 3, 2); dot(dx + 1, dy, 'rgb(200,255,240)'); glow(dx, dy, 3, 2); }
    if (lv.glows.length < 26) lv.glows.push({ x: px + 8, y: py + 8, r: 32, c: [0.1, 0.55, 0.45] });
  } else if (lv.bi === 2 && r > 0.93) {   // molten cracks
    let cx = 2 + ri(12), cy = 2 + ri(6); for (let i = 8 + ri(6); i > 0; i--) { dot(cx, cy, 'rgb(255,130,40)'); glow(cx, cy); cx = clamp(cx + ri(3) - 1, 0, 15); cy = clamp(cy + (rnd() < 0.6 ? 1 : 0), 0, 15); }
  } else if (lv.bi !== 2 && r > 0.988) { dot(4, 4, '#14121a', 8, 8); for (let i = 5; i < 12; i += 2) dot(i, 4, 'rgb(84,84,100)', 1, 8); dot(4, 4, 'rgb(84,84,100)', 8, 1); dot(4, 11, 'rgb(40,40,52)', 8, 1); }
}

function bakeLevel(lv) {
  const { map, B } = lv, W = MW * TS, H = MH * TS;
  lv.floorA = mk(W, H); lv.floorD = mk(W, H);
  const fa = lv.floorA.getContext('2d'), fd = lv.floorD.getContext('2d');
  fa.fillStyle = '#000'; fa.fillRect(0, 0, W, H); fd.fillStyle = '#000'; fd.fillRect(0, 0, W, H);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x, t = map[i], px = x * TS, py = y * TS;
    if (t === 1) continue;
    if (t === 3) { paintPit(fa, fd, x, y, lv); continue; }
    paintFloor(fa, x, y, lv.style[i], B);
    if (t === 2) {
      fa.fillStyle = `rgba(${B.water[0]},${B.water[1]},${B.water[2]},0.62)`; fa.fillRect(px, py, TS, TS);
      fa.fillStyle = 'rgba(255,255,255,0.1)'; for (let k = 0; k < 3; k++) fa.fillRect(px + Math.floor(hsh(x * 3 + k, y) * 12), py + Math.floor(hsh(x, y * 5 + k) * 15), 3, 1);
      fd.fillStyle = `rgb(0,${K_WATER},0)`; fd.fillRect(px, py, TS, TS);
    } else if (t === 4) { fd.fillStyle = `rgb(0,${K_LAVA},0)`; fd.fillRect(px, py, TS, TS); }
    if (t === 2 || t === 4) {   // shore: a rim of rock (lava) or a pale waterline
      const rim = (dx, dy, w, h) => { if (t === 4) { fa.fillStyle = rgb(B.floor, 0.42); fa.fillRect(px + dx, py + dy, w, h); fd.fillStyle = '#000'; fd.fillRect(px + dx, py + dy, w, h); } else { fa.fillStyle = 'rgba(255,255,255,0.16)'; fa.fillRect(px + dx, py + dy, Math.min(w, TS), Math.min(h, TS)); } };
      const e = t === 4 ? 2 : 1;
      if (tileAt(x, y - 1) !== t) rim(0, 0, TS, e); if (tileAt(x, y + 1) !== t) rim(0, TS - e, TS, e);
      if (tileAt(x - 1, y) !== t) rim(0, 0, e, TS); if (tileAt(x + 1, y) !== t) rim(TS - e, 0, e, TS);
    }
  }
  for (const r of lv.rooms) if (r.type === 'treasure' || r.type === 'altar' || r.type === 'arena') paintRug(fa, lv, r);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (map[y * MW + x] === 0) decal(fa, fd, lv, x, y);
  for (const b of lv.braziers) for (let k = 0; k < 72; k++) {   // engraved ring around each brazier
    const an = k / 72 * TAU, x = Math.round(b.x + Math.cos(an) * 13), y = Math.round(b.y + Math.sin(an) * 13);
    if (map[Math.floor(y / TS) * MW + Math.floor(x / TS)] !== 0) continue;
    fa.fillStyle = k % 9 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.5)'; fa.fillRect(x, y, 1, 1);
  }
  // ambient occlusion where floors meet walls
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const t = map[y * MW + x], px = x * TS, py = y * TS;
    if (t === 1 || t === 3 || t === 4) continue;
    if (wallT(x, y - 1)) [0.5, 0.4, 0.3, 0.21, 0.13, 0.07].forEach((al, k) => { fa.fillStyle = `rgba(0,0,8,${al})`; fa.fillRect(px, py + k, TS, 1); });
    if (wallT(x - 1, y)) [0.3, 0.2, 0.11, 0.05].forEach((al, k) => { fa.fillStyle = `rgba(0,0,8,${al})`; fa.fillRect(px + k, py, 1, TS); });
    if (wallT(x + 1, y)) [0.3, 0.2, 0.11, 0.05].forEach((al, k) => { fa.fillStyle = `rgba(0,0,8,${al})`; fa.fillRect(px + TS - 1 - k, py, 1, TS); });
  }
  lv.rowA = []; lv.rowD = [];
  for (let y = 0; y < MH; y++) {
    const A = mk(W, TS + WALL_H), D = mk(W, TS + WALL_H), ra = A.getContext('2d'), rd = D.getContext('2d');
    for (let x = 0; x < MW; x++) if (map[y * MW + x] === 1) paintWall(ra, rd, x, y, lv);
    lv.rowA.push(A); lv.rowD.push(D);
  }
  for (const dcr of lv.decor) paintWallDecor(lv.rowA[dcr.ty].getContext('2d'), lv.rowD[dcr.ty].getContext('2d'), dcr.tx, dcr.ty, dcr.kind, lv);
  const walls = new Uint8Array(MW * MH);
  for (let i = 0; i < walls.length; i++) walls[i] = map[i] === 1 ? 255 : 0;
  gfxSetMap(walls);
}
