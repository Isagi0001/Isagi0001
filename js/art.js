'use strict';
/* Procedural pixel art: biome palettes, sprites (colour + data + flash variants), tile painters */
const BIOMES = [
  { name: 'Катакомбы', sub: 'Забытые склепы', song: 'b0', floor: [104, 96, 128], tileA: [122, 106, 112], tileB: [86, 82, 114], top: [98, 102, 136], brick: [150, 106, 96], rug: [128, 36, 48], banner: [150, 40, 52], moss: [70, 120, 60], water: [40, 92, 176],
    amb: [0.05, 0.055, 0.115], abyss: [0.08, 0.14, 0.42], grade: [1, 1, 1.05], torch: [1, 0.52, 0.2], decor: ['banner', 'chains', 'crack', 'niche', 'vines'] },
  { name: 'Затопленные чертоги', sub: 'Где камень помнит море', song: 'b1', floor: [78, 108, 110], tileA: [98, 126, 118], tileB: [60, 92, 104], top: [72, 112, 116], brick: [92, 126, 120], rug: [30, 84, 110], banner: [36, 110, 120], moss: [60, 150, 90], water: [26, 120, 136],
    amb: [0.035, 0.085, 0.095], abyss: [0.04, 0.36, 0.38], grade: [0.95, 1.03, 1.03], torch: [0.45, 1, 0.75], decor: ['vines', 'vines', 'grate', 'crack', 'chains'] },
  { name: 'Пепельная кузня', sub: 'Сердце угасшего огня', song: 'b2', floor: [98, 80, 78], tileA: [114, 90, 82], tileB: [70, 60, 66], top: [86, 70, 76], brick: [84, 66, 72], rug: [120, 60, 20], banner: [170, 90, 20], moss: [90, 70, 60], water: [200, 80, 20],
    amb: [0.1, 0.05, 0.045], abyss: [0.95, 0.32, 0.05], grade: [1.06, 0.98, 0.93], torch: [1, 0.42, 0.12], decor: ['chains', 'crack', 'ember', 'ember', 'niche'] },
];
const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, s = t => t * t * (3 - 2 * t);
  return lerp(lerp(hsh(xi, yi), hsh(xi + 1, yi), s(fx)), lerp(hsh(xi, yi + 1), hsh(xi + 1, yi + 1), s(fx)), s(fy)); };

/* ---------- sprite builders ---------- */
// grid cells: null | [r, g, b, emission]. Result: A colour, D data (R height*8, G kind, B emission), W white flash, E emissive data.
function finishSprite(grid, o = {}) {
  const ol = o.outline !== false, pad = o.pad !== undefined ? o.pad : (ol ? 1 : 0), z = o.z || 0;
  if (pad) {
    const w0 = grid[0].length, blank = () => new Array(w0 + pad * 2).fill(null), side = () => new Array(pad).fill(null);
    grid = [...Array.from({ length: pad }, blank), ...grid.map(r => [...side(), ...r, ...side()]), ...Array.from({ length: pad }, blank)];
  }
  const h = grid.length, w = grid[0].length;
  if (ol) {
    const src = grid.map(r => r.slice());
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      if (!src[y][x] && ((y > 0 && src[y - 1][x]) || (y < h - 1 && src[y + 1][x]) || (x > 0 && src[y][x - 1]) || (x < w - 1 && src[y][x + 1]))) grid[y][x] = [18, 14, 26, 0];
  }
  const A = mk(w, h), D = mk(w, h), W = mk(w, h), E = mk(w, h), a = A.getContext('2d'), d = D.getContext('2d'), wc = W.getContext('2d'), e = E.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = grid[y][x]; if (!c) continue;
    const hv = Math.min(31, h - y + z) * 8;
    a.fillStyle = rgb(c); a.fillRect(x, y, 1, 1);
    d.fillStyle = `rgb(${hv},${K_SPR},${Math.round((c[3] || 0) * 255)})`; d.fillRect(x, y, 1, 1);
    wc.fillStyle = '#fff'; wc.fillRect(x, y, 1, 1);
    e.fillStyle = `rgb(${hv},${K_SPR},255)`; e.fillRect(x, y, 1, 1);
  }
  return { A, D, W, E, w, h };
}
// o.emis: string of emissive chars, or { char: 0..1 }
function strSprite(rows, pal, o = {}) {
  const em = o.emis || '', P = {};
  for (const k in pal) P[k] = typeof pal[k] === 'string' ? hexc(pal[k]) : pal[k];
  const w = Math.max(...rows.map(r => r.length));
  return finishSprite(rows.map(r => Array.from({ length: w }, (_, x) => {
    const ch = r[x]; if (!ch || !P[ch]) return null;
    return [P[ch][0], P[ch][1], P[ch][2], typeof em === 'string' ? (em.includes(ch) ? 1 : 0) : (em[ch] || 0)];
  })), o);
}
const fnSprite = (w, h, fn, o) => finishSprite(Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y))), o);

function flameFrames(w, h, cols, z) {
  const out = [];
  for (let f = 0; f < 4; f++) out.push(fnSprite(w, h, (x, y) => {
    const v = y / (h - 1), u = (x + 0.5 - w / 2) / (w / 2);
    const wob = (Math.sin(v * 5 + f * 1.7) * 0.3 + Math.sin(f * 2.4 + v * 9) * 0.12) * (1 - v);
    const prof = Math.pow(Math.sin(Math.min(1, v * 1.3) * Math.PI / 2), 1.3) * (v > 0.8 ? 1 - (v - 0.8) * 1.4 : 1);
    if (prof < 0.05) return null;
    const dd = Math.abs(u - wob) / prof; if (dd > 1) return null;
    const heat = (1 - dd) * (0.3 + 0.7 * v), c = heat > 0.6 ? cols[3] : heat > 0.38 ? cols[2] : heat > 0.16 ? cols[1] : cols[0];
    return [c[0], c[1], c[2], 1];
  }, { outline: false, z }));
  return out;
}

/* ---------- sprites ---------- */
const S = {};
(function buildSprites() {
  const HP = { H: '#1e2a52', h: '#32488a', f: '#141226', e: '#ffd98a', c: '#2f4a8c', C: '#4a6cc0', d: '#1f2f5e', s: '#e06a28', S: '#ffa648', B: '#d9b04a', g: '#e8b98a', b: '#3a2a22' };
  const front = ['....HHHH....', '...HhhhhH...', '..HhhhhhhH..', '..HhffffhH..', '..HfeffefH..', '..HhffffhH..', '...sSsssS...', '..CsSssscC..', '.CCcccccccC.', '.CcccBBcccc.', '.gcccccccdg.', '.gcdcccdccg.', '..cdcccdcd..', '..ddccccdd..', '..dd.dd.dd..'];
  const back = ['....HHHH....', '...HhhhhH...', '..HhhhhhhH..', '..HhhHHhhH..', '..HhhHHhhH..', '..HhhhhhhH..', '...sSsssS...', '..CcsSsccC..', '.CCccsSccCC.', '.CcccsScccc.', '.gcccccccdg.', '.gcdcccdccg.', '..cdcccdcd..', '..ddccccdd..', '..dd.dd.dd..'];
  const legs = [['...bb..bb...', '...bb..bb...'], ['...bb..bb...', '...bb.......'], ['...bb..bb...', '.......bb...']];
  S.hero = { front: legs.map(l => strSprite([...front, ...l], HP, { emis: 'e' })), back: legs.map(l => strSprite([...back, ...l], HP)) };
  S.sword = strSprite(['..g.bbbbbbb..', 'hhgbwrwwrwwbB', '..g.bbbbbbb..'], { h: '#6b4a2a', g: '#d9b04a', b: '#9aa6b8', w: '#e6edf5', r: '#ffb04a', B: '#ffffff' }, { emis: { r: 1, B: 0.6 }, outline: false, pad: 2, z: 6 });

  const slime = ['....gggggg....', '..ggGGGggggg..', '.ggGWGggggggg.', '.gGGggggggggg.', 'ggggkkggggkkgg', 'ggggkwggggkwgg', 'gggggggggggggg', 'gdggggggggggdg', '.dddggggggddd.', '..dddddddddd..'];
  S.slime = [
    strSprite(slime, { g: '#58c846', G: '#a8f090', W: '#ffffff', d: '#2f8030', k: '#16301a', w: '#ffffff' }),
    strSprite(slime, { g: '#3aa8c8', G: '#90e8f8', W: '#ffffff', d: '#1f6a90', k: '#0c2838', w: '#ffffff' }, { emis: { G: 0.4 } }),
    strSprite(slime, { g: '#d8501c', G: '#ffb040', W: '#fff0a0', d: '#7a2410', k: '#2a0c08', w: '#ffe080' }, { emis: { G: 1, W: 1, g: 0.35, w: 1 } }),
  ];
  const BP = { p: '#8a5ad8', R: '#ff5050' };
  S.bat = [
    strSprite(['p............p', 'pp....pp....pp', 'ppp..pppp..ppp', '.ppppRppRpppp.', '..pppppppppp..', '...pp.pp.pp...', '..............'], BP, { emis: 'R', z: 8 }),
    strSprite(['..............', '......pp......', '.....pppp.....', '.ppppRppRpppp.', 'pppppppppppppp', 'pp..pppppp..pp', 'p....p..p....p'], BP, { emis: 'R', z: 8 }),
  ];
  S.skel = strSprite(['...wwwwww...', '..wwwwwwww..', '..wkkwwkkw..', '..wkRwwRkw..', '..wwwkkwww..', '...wkwkwk...', '....wwww....', '..ssbwwbss..', '.wsbwbbwbsw.', '.w.bwbbwb.w.', '.w.bbwwbb.w.', '.w..bbbb..w.', '....w..w....', '....w..w....', '....w..w....', '...ww..ww...'],
    { w: '#e0dccb', k: '#2a2030', R: '#ff5a3a', s: '#7a8296', b: '#4a4458' }, { emis: 'R' });
  S.cult = strSprite(['....rrrr....', '...rRRRRr...', '..rRRRRRRr..', '..rRkkkkRr..', '..rRkMkMkr..', '..rRkkkkRr..', '...rrRRrr...', '..rRRRRRRr..', '.rRRRyyRRRr.', '.rRRRRRRRRr.', '.rRrRRRRrRr.', '.rRrRRRRrRr.', '..rRRRRRRr..', '..rRRRRRRr..', '.rrRRRRRRrr.', '.rrrrrrrrrr.'],
    { r: '#5a1f3a', R: '#8a2f52', k: '#140c18', M: '#ff60e8', y: '#e8c050' }, { emis: 'M' });
  S.wraith = strSprite(['....tttt....', '...tTTTTt...', '..tTTTTTTt..', '..tTETTETt..', '..tTTTTTTt..', '..tTTkkTTt..', '.ttTTTTTTtt.', '.tTTTTTTTTt.', '.tTTTTTTTTt.', '..tTTTTTTt..', '..tTTtTTTt..', '...tTttTt...', '...tt..tt...', '....t...t...'],
    { t: '#3a8a9a', T: '#8adcdc', E: '#ffffff', k: '#103038' }, { emis: { T: 0.35, t: 0.2, E: 1 }, outline: false, z: 4 });
  // boss: shaded shapes with a molten core
  S.boss = fnSprite(30, 32, (x, y) => {
    const cx = 14.5; let inside = false, nx = 0, ny = 0, base = [74, 64, 84];
    const ell = (ex, ey, rx, ry) => { const u = (x - ex) / rx, v = (y - ey) / ry; if (u * u + v * v <= 1) { inside = true; nx = u; ny = v; return true; } return false; };
    ell(cx, 21, 11, 10); ell(4.5, 15, 4.5, 5); ell(24.5, 15, 4.5, 5);
    if (ell(cx, 9, 6.5, 6.5)) base = [94, 82, 104];
    const hx = Math.abs(x - cx);
    if (y < 7 && hx >= 5 + (6 - y) * 0.5 && hx <= 6.6 + (6 - y) * 0.5) { inside = true; base = [206, 196, 176]; nx = 0; ny = -0.5; }
    if (y >= 28 && ((x >= 8 && x <= 12) || (x >= 17 && x <= 21))) { inside = true; nx = 0; ny = 0.6; }
    if (!inside) return null;
    if (y === 9 && (x === 11 || x === 12 || x === 17 || x === 18)) return [255, 190, 70, 1];
    const dc = Math.hypot(x - cx, y - 21);
    if (dc < 2.6) return [255, 228, 130, 1];
    if (dc < 4) return [255, 120, 30, 1];
    if (y > 12 && y < 29 && hsh(x * 3, y * 7) < 0.07) return [255, 110, 30, 0.9];
    const l = -nx * 0.5 - ny * 0.7, k = l > 0.35 ? 1.32 : l > -0.1 ? 1 : 0.66;
    return [base[0] * k, base[1] * k, base[2] * k, 0];
  });

  S.barrel = strSprite(['..bbbbbb..', '.bBBBBBBb.', 'bBBbBBbBBb', 'mmmmmmmmmm', 'bBBbBBbBBb', 'bBBbBBbBBb', 'bBBbBBbBBb', 'bBBbBBbBBb', 'mmmmmmmmmm', 'bBBbBBbBBb', '.bBbBBbBb.', '..bbbbbb..'], { b: '#6a4426', B: '#96643a', m: '#70788a' });
  S.crate = strSprite(['ccccccccccc', 'cCCCCCCCCCc', 'cCcCCCCCcCc', 'cCCcCCCcCCc', 'cCCCcCcCCCc', 'cCCCCcCCCCc', 'cCCCcCcCCCc', 'cCCcCCCcCCc', 'cCcCCCCCcCc', 'cCCCCCCCCCc', 'ccccccccccc'], { c: '#5e4022', C: '#a67c4a' });
  S.urn = strSprite(['..uuuu..', '..uUUu..', '...uu...', '..uUUu..', '.uUUUUu.', 'uUWUUUUu', 'uUWUUUUu', 'uUUUUUUu', '.uUUUUu.', '..uUUu..', '..uuuu..'], { u: '#7a4a3a', U: '#b8785a', W: '#e8b090' });
  const CH = { w: '#5a3a22', W: '#8a5c34', y: '#d9b04a', Y: '#fff0a0', k: '#1a1218', G: '#ffd24a' };
  S.chestC = strSprite(['.wwwwwwwwwwww.', 'wWWWWWWWWWWWWw', 'wWWWWWWWWWWWWw', 'yyyyyyyyyyyyyy', 'wWWWWWyyWWWWWw', 'wWWWWWyYWWWWWw', 'wWWWWWWWWWWWWw', 'wWWWWWWWWWWWWw', 'wwwwwwwwwwwwww'], CH, { emis: { Y: 0.8 } });
  S.chestO = strSprite(['.wwwwwwwwwwww.', 'wWWWWWWWWWWWWw', 'wwwwwwwwwwwwww', 'wkkkkkkkkkkkkw', 'wkGGGkGGkGGGkw', 'yyyyyyyyyyyyyy', 'wWWWWWWWWWWWWw', 'wWWWWWWWWWWWWw', 'wwwwwwwwwwwwww'], CH, { emis: { G: 0.8 } });
  const brz = ['.icccccccci.', 'iIIIIIIIIIIi', '.iIIIIIIIIi.', '..iiIIIIii..', '....iIIi....', '....iIIi....', '...iiIIii...', '..iiiiiiii..'];
  S.brazOff = strSprite(brz, { i: '#4a4658', I: '#77728a', c: '#2a2630' });
  S.brazOn = strSprite(brz, { i: '#4a4658', I: '#77728a', c: '#ffb040' }, { emis: 'c' });
  S.altar = strSprite(['..aaaaaaaa..', '.aAAAAAAAAa.', '.aAAvAAvAAa.', '.aAAAvvAAAa.', '.aAAvAAvAAa.', '.aAAAAAAAAa.', 'aaaaaaaaaaaa', 'aAAAAAAAAAAa', 'aaaaaaaaaaaa'], { a: '#4a4460', A: '#7c7498', v: '#c070ff' }, { emis: 'v' });
  const CP = { y: '#c8901c', Y: '#ffd24a', W: '#fff8c0' };
  S.coin = [strSprite(['.yyyy.', 'yYYYYy', 'yYWYYy', 'yYYYYy', 'yYYYYy', '.yyyy.'], CP, { emis: { Y: 0.5, W: 1 }, z: 2 }), strSprite(['..yy..', '..YY..', '..WY..', '..YY..', '..YY..', '..yy..'], CP, { emis: { Y: 0.5, W: 1 }, z: 2 })];
  S.heart = strSprite(['.rr.rr.', 'rRrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], { r: '#ff3a50', R: '#ffc0c8' }, { emis: { r: 0.7, R: 1 }, z: 3 });
  S.mana = strSprite(['..mm..', '.mMMm.', 'mMWMMm', 'mMMMMm', '.mMMm.', '..mm..'], { m: '#2a60e0', M: '#70b0ff', W: '#ffffff' }, { emis: { m: 0.6, M: 1, W: 1 }, z: 3 });
  S.potion = strSprite(['..ww..', '..cc..', '.gGGg.', 'gGrrGg', 'gRrrrg', 'grrrrg', '.gggg.'], { w: '#c8b890', c: '#8a6a40', g: '#a8c8d8', G: '#e8f8ff', r: '#e83048', R: '#ff90a0' }, { emis: { r: 0.6, R: 0.8 }, z: 2 });
  S.spikes = strSprite(['.s...s...s..', '.s...s...s..', 'sSs.sSs.sSs.', 'sSs.sSs.sSs.', 'sSs.sSs.sSs.'], { s: '#8a92a6', S: '#e6edf5' }, { outline: false });
  S.bracket = strSprite(['.kkk.', 'kKKKk', '.kKk.', '..k..', '..k..'], { k: '#3a3440', K: '#6a6276' }, { z: 5 });
  const FL = [[[196, 48, 20], [255, 120, 30], [255, 205, 80], [255, 250, 205]], [[16, 110, 96], [40, 205, 160], [150, 255, 215], [235, 255, 245]], [[150, 20, 10], [240, 70, 20], [255, 160, 50], [255, 235, 170]]];
  S.flame = FL.map(c => flameFrames(7, 10, c, 10));
  S.flameBig = flameFrames(11, 15, [[220, 90, 20], [255, 165, 45], [255, 228, 125], [255, 255, 235]], 8);
})();

/* ---------- tile painters ---------- */
function paintFloor(fa, x, y, style, B) {
  const px = x * TS, py = y * TS, r = hsh(x, y), tone = 0.84 + vnoise(x / 4 + 9, y / 4 + 3) * 0.3;
  const base = style === 2 ? ((x + y) % 2 ? B.tileA : B.tileB) : B.floor;
  const stone = (sx, sy, w, h, k) => {
    fa.fillStyle = rgb(base, k); fa.fillRect(px + sx, py + sy, w, h);
    fa.fillStyle = rgb(base, k * 1.22); fa.fillRect(px + sx, py + sy, w - 1, 1); fa.fillRect(px + sx, py + sy, 1, h - 1);
    fa.fillStyle = rgb(base, k * 0.58); fa.fillRect(px + sx, py + sy + h - 1, w, 1); fa.fillRect(px + sx + w - 1, py + sy, 1, h);
  };
  const v = i => tone * (0.9 + hsh(x * 9 + i, y * 5 - i) * 0.2);
  if (style === 1) {   // cobbles: four irregular stones
    const sx = 6 + Math.floor(r * 5), sx2 = 6 + Math.floor(hsh(x + 7, y) * 5), sy = 6 + Math.floor(hsh(y, x) * 5);
    stone(0, 0, sx, sy, v(0)); stone(sx, 0, 16 - sx, sy, v(1)); stone(0, sy, sx2, 16 - sy, v(2)); stone(sx2, sy, 16 - sx2, 16 - sy, v(3));
  } else if (style === 2) {   // polished checker with an inlay
    stone(0, 0, 16, 16, tone);
    fa.fillStyle = rgb(base, tone * 0.78); fa.fillRect(px + 3, py + 3, 10, 1); fa.fillRect(px + 3, py + 12, 10, 1); fa.fillRect(px + 3, py + 3, 1, 10); fa.fillRect(px + 12, py + 3, 1, 10);
    fa.fillStyle = rgb(base, tone * 1.3); fa.fillRect(px + 7, py + 7, 2, 2);
  } else if (r < 0.35) { stone(0, 0, 16, 8, v(0)); stone(0, 8, 16, 8, v(1)); }
  else if (r < 0.55) { stone(0, 0, 8, 16, v(0)); stone(8, 0, 8, 16, v(1)); }
  else stone(0, 0, 16, 16, v(0));
  for (let i = 0; i < 5; i++) {
    fa.fillStyle = rgb(base, tone * (hsh(x * 7 + i, y * 3) < 0.5 ? 0.76 : 1.22));
    fa.fillRect(px + 1 + Math.floor(hsh(x * 5 + i, y) * 13), py + 1 + Math.floor(hsh(x, y * 5 + i) * 14), hsh(i, x + y) < 0.3 ? 2 : 1, 1);
  }
}

// The visible north wall of a pit: bricks fading into darkness; data stores depth for the fog shader.
function paintPit(fa, fd, x, y, lv) {
  const px = x * TS, py = y * TS, B = lv.B;
  let n = 0; while (tileAt(x, y - 1 - n) === 3) n++;
  for (let j = 0; j < TS; j++) {
    const depth = n * TS + j, k = Math.max(0, 1 - depth / 42) * 0.8, course = Math.floor(depth / 5), mortar = depth % 5 === 4;
    for (let i = 0; i < TS; i++) {
      const gx = px + i + (course % 2 ? 4 : 0), seam = gx % 8 === 7;
      fa.fillStyle = depth === 0 ? rgb(B.floor, 1.25) : rgb(B.brick, k * (mortar || seam ? 0.5 : 0.85 + hsh(Math.floor(gx / 8), course + y * 9) * 0.3));
      fa.fillRect(px + i, py + j, 1, 1);
    }
    fd.fillStyle = `rgb(${Math.min(255, depth * 5)},${K_PIT},0)`; fd.fillRect(px, py + j, TS, 1);
  }
}

function paintWall(ra, rd, x, y, lv) {
  const B = lv.B, px = x * TS, W = (i, j) => wallT(x + i, y + j), r = hsh(x * 13, y * 7);
  let edge = false;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!W(i, j)) edge = true;
  if (!edge) {
    ra.fillStyle = '#0b0a12'; ra.fillRect(px, 0, TS, TS);
    ra.fillStyle = '#16141f'; for (let i = 0; i < 3; i++) ra.fillRect(px + Math.floor(hsh(x + i, y * 3) * 14), Math.floor(hsh(x * 3, y + i) * 14), 2, 1);
  } else {
    ra.fillStyle = rgb(B.top, 0.84 + r * 0.26); ra.fillRect(px, 0, TS, TS);
    ra.fillStyle = rgb(B.top, 0.6); if (r < 0.5) ra.fillRect(px + 7, 0, 1, TS); else ra.fillRect(px, 7, TS, 1);
    for (let i = 0; i < 5; i++) { ra.fillStyle = rgb(B.top, hsh(x + i, y) < 0.5 ? 0.72 : 1.2); ra.fillRect(px + 1 + Math.floor(hsh(x * 5 + i, y) * 12), 1 + Math.floor(hsh(x, y * 3 + i) * 13), 2, 1); }
    ra.fillStyle = rgb(B.top, 1.5);
    if (!W(0, -1)) ra.fillRect(px, 0, TS, 1);
    if (!W(-1, 0)) ra.fillRect(px, 0, 1, TS);
    ra.fillStyle = rgb(B.top, 0.48);
    if (!W(0, 1)) ra.fillRect(px, TS - 1, TS, 1);
    if (!W(1, 0)) ra.fillRect(px + TS - 1, 0, 1, TS);
  }
  rd.fillStyle = `rgb(${WALL_H * 8},${K_TOP},0)`; rd.fillRect(px, 0, TS, TS);
  if (W(0, 1)) return;
  // south face: three brick courses under a light lip
  for (let i = 0; i < WALL_H; i++) {
    const lip = i === 0, mortar = i === 5 || i === 10, course = i < 5 ? 0 : i < 10 ? 1 : 2, grad = 1.1 - i * 0.022;
    for (let j = 0; j < TS; j++) {
      const gx = px + j + (course === 1 ? 4 : 0), bi = Math.floor(gx / 8), seam = gx % 8 === 7;
      let k = lip ? 1.3 : mortar || seam ? 0.48 : (0.86 + hsh(bi, y * 3 + course) * 0.28) * (i === 1 || i === 6 || i === 11 ? 1.14 : i === 4 || i === 9 || i === 13 ? 0.8 : 1);
      if (course === 2 && !mortar) k *= 0.82;
      ra.fillStyle = rgb(B.brick, k * grad); ra.fillRect(px + j, TS + i, 1, 1);
    }
    rd.fillStyle = `rgb(${(WALL_H - i) * 8},${K_FRONT},0)`; rd.fillRect(px, TS + i, TS, 1);
  }
}

function paintWallDecor(ra, rd, tx, ty, kind, lv) {
  const B = lv.B, px = tx * TS, y0 = TS;
  const P = (x, i, col, w = 1, h = 1) => { ra.fillStyle = col; ra.fillRect(px + x, y0 + i, w, h); };
  const glowPx = (x, i, w = 1, h = 1) => { for (let k = 0; k < h; k++) { rd.fillStyle = `rgb(${(WALL_H - i - k) * 8},${K_FRONT},255)`; rd.fillRect(px + x, y0 + i + k, w, 1); } };
  if (kind === 'banner') {
    P(3, 1, 'rgb(150,120,60)', 10, 1);
    for (let i = 2; i < 13; i++) for (let x = 4; x < 12; x++) {
      if (i >= 11 && (x + i) % 2) continue;
      P(x, i, rgb(B.banner, (x === 4 || x === 11 ? 0.7 : 1) * (1.1 - i * 0.03)));
    }
    P(7, 5, 'rgb(230,190,90)', 2, 1); P(6, 6, 'rgb(230,190,90)', 4, 1); P(7, 7, 'rgb(230,190,90)', 2, 1);
  } else if (kind === 'vines') {
    for (let s = 0; s < 5; s++) { const x = 1 + ri(14), len = 3 + ri(10); for (let i = 0; i < len; i++) { P(x + (i % 3 === 2 ? ri(3) - 1 : 0), i, rgb(B.moss, 0.7 + rnd() * 0.6)); } }
  } else if (kind === 'chains') {
    for (const x of [5, 10]) { const len = 7 + ri(6); for (let i = 1; i < len; i++) P(x, i, i % 2 ? 'rgb(156,156,170)' : 'rgb(66,66,82)'); P(x - 1, len, 'rgb(120,120,136)', 3, 1); }
  } else if (kind === 'crack') {
    let x = 3 + ri(10); for (let i = 0; i < 11; i++) { P(x, i, 'rgba(0,0,0,0.55)'); if (rnd() < 0.6) x = clamp(x + ri(3) - 1, 1, 14); }
  } else if (kind === 'niche') {
    P(5, 4, '#17131f', 6, 7); P(6, 3, '#17131f', 4, 1); P(7, 8, 'rgb(232,222,190)', 2, 3);
    P(7, 6, 'rgb(255,224,130)', 2, 2); glowPx(7, 6, 2, 2);
    lv.glows.push({ x: px + 8, y: (ty + 1) * TS + 3, r: 36, c: [0.8, 0.48, 0.2] });
  } else if (kind === 'grate') {
    P(5, 4, '#10141a', 6, 4); for (let x = 6; x < 11; x += 2) P(x, 4, 'rgb(90,100,110)', 1, 4);
    for (let i = 8; i < WALL_H; i++) P(6 + ri(2), i, 'rgba(20,70,80,0.45)', 3, 1);
  } else if (kind === 'ember') {
    let x = 2 + ri(12); for (let i = 1; i < 12; i++) { P(x, i, 'rgb(255,128,36)'); glowPx(x, i); if (rnd() < 0.7) x = clamp(x + ri(3) - 1, 1, 14); }
    if (rnd() < 0.5) lv.glows.push({ x: px + 8, y: (ty + 1) * TS + 3, r: 30, c: [0.8, 0.25, 0.05] });
  }
}
