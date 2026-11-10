'use strict';
/* Simulation: hero, enemies, combat, loot, hazards, particles */
let enemies = [], bolts = [], parts = [], pickups = [], texts = [], flashes = [], slashes = [], novas = [], motes = [];
const cam = { x: 0, y: 0, fx: 0, fy: 0 };
const G = { depth: 1, runSeed: 1, time: 0, runTime: 0, shake: 0, hurtFx: 0, flash: 0, freeze: 0, fade: 0, menuMode: false, boss: null, bossAwake: false, victory: false, won: false,
  pending: 0, altarCost: 60, toast: null, banner: null, prompt: null, msgCd: 0, flow: null, flowT: 0, seenT: 0, inp: {}, solids: [] };
const pl = { x: -9999, y: -9999, ang: 0 };
const HERO_KEYS = ['hp', 'maxHp', 'mp', 'maxMp', 'lvl', 'xp', 'gold', 'potions', 'atk', 'spell', 'speedK', 'crit', 'arcK', 'shots', 'cdK', 'regen', 'leech', 'lightK', 'potK', 'perks', 'kills'];
const EDEF = {
  slime: { hp: 30, dmg: 10, sp: 34, xp: 8, r: 6, gold: 2, col: ['#58c846', '#3aa8c8', '#ff8030'] },
  bat: { hp: 14, dmg: 8, sp: 62, xp: 6, r: 5, gold: 1, fly: true, col: '#8a5ad8' },
  skel: { hp: 44, dmg: 14, sp: 42, xp: 14, r: 6, gold: 3, col: '#e0dccb' },
  cult: { hp: 30, dmg: 12, sp: 32, xp: 16, r: 6, gold: 4, col: '#b03a6a' },
  wraith: { hp: 36, dmg: 14, sp: 27, xp: 18, r: 6, gold: 4, fly: true, ghost: true, col: '#8adcdc' },
  boss: { hp: 700, dmg: 20, sp: 30, xp: 150, r: 13, gold: 60, col: '#ff7a20' },
};
const PERKS = [
  { id: 'hp', name: 'Закалка', desc: '+25 к здоровью и лечит 25', f: () => { pl.maxHp += 25; pl.hp = Math.min(pl.maxHp, pl.hp + 25); } },
  { id: 'atk', name: 'Острый клинок', desc: '+25% урона мечом', f: () => { pl.atk *= 1.25; } },
  { id: 'spell', name: 'Жар Искры', desc: '+30% урона заклинаний', f: () => { pl.spell *= 1.3; } },
  { id: 'mana', name: 'Глубокий резерв', desc: '+25 маны, быстрее восстановление', f: () => { pl.maxMp += 25; pl.mp += 25; pl.regen *= 1.4; } },
  { id: 'speed', name: 'Лёгкий шаг', desc: '+10% к скорости бега', max: 3, f: () => { pl.speedK *= 1.1; } },
  { id: 'leech', name: 'Жатва', desc: 'Каждое убийство лечит 3 здоровья', f: () => { pl.leech += 3; } },
  { id: 'crit', name: 'Меткий глаз', desc: '+12% шанс двойного урона', max: 4, f: () => { pl.crit += 0.12; } },
  { id: 'arc', name: 'Широкий взмах', desc: '+20% дальность и дуга меча', max: 3, f: () => { pl.arcK *= 1.2; } },
  { id: 'multi', name: 'Тройная искра', desc: '+1 снаряд Искры за выстрел', max: 2, f: () => { pl.shots++; } },
  { id: 'cd', name: 'Спешка', desc: '−18% перезарядки умений', max: 3, f: () => { pl.cdK *= 0.82; } },
  { id: 'pot', name: 'Алхимик', desc: '+2 зелья, зелья лечат сильнее', max: 3, f: () => { pl.potions = Math.min(9, pl.potions + 2); pl.potK *= 1.4; } },
  { id: 'light', name: 'Сияние', desc: '+25% радиус света, +10 к здоровью', max: 3, f: () => { pl.lightK *= 1.25; pl.maxHp += 10; pl.hp += 10; } },
];
const xpNeed = l => Math.round(30 * Math.pow(l, 1.5));
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const shake = v => { if (SET.shake) G.shake = Math.max(G.shake, v); };
const toast = t => { G.toast = { text: t, t: 3 }; };
const addText = (x, y, txt, col = '#fff', big = false) => { if (texts.length < 60) texts.push({ x, y, txt: String(txt), col, big, t: 0 }); };
const ecol = e => Array.isArray(e.def.col) ? e.def.col[LV.bi] : e.def.col;

/* ---------- particles ---------- */
function part(o) { if (parts.length < 700) parts.push(Object.assign({ z: 0, vx: 0, vy: 0, vz: 0, life: 0.5, g: 260, size: 1, em: 255, col: '#fff' }, o)); }
function burst(x, y, z, col, n, sp = 60, em = 255) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = Math.random() * sp; part({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: 20 + Math.random() * 70, life: 0.3 + Math.random() * 0.45, col, size: Math.random() < 0.3 ? 2 : 1, em }); }
}
function updateParts(dt) {
  for (const p of parts) {
    p.life -= dt; p.vz -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5; }
  }
  parts = parts.filter(p => p.life > 0);
  for (const a of [flashes, slashes, novas, texts]) for (const o of a) o.t += dt;
  flashes = flashes.filter(f => f.t < f.max); slashes = slashes.filter(s => s.t < s.max); novas = novas.filter(n => n.t < 0.45); texts = texts.filter(t => t.t < 0.9);
}
function initMotes() { motes = Array.from({ length: 46 }, () => ({ x: Math.random() * VW, y: Math.random() * (VH + 30), z: 4 + Math.random() * 22, ph: Math.random() * TAU, s: 2 + Math.random() * 5 })); }
// Embers, smoke, drips and abyss motes spawned around the visible area.
function ambientFx(dt) {
  const inView = (x, y) => x > cam.x - 16 && x < cam.x + VW + 16 && y > cam.y - 16 && y < cam.y + VH + 40;
  const fc = [['#ffb040', '#ff7020'], ['#80ffd8', '#30c8a0'], ['#ff9030', '#ff4810']][LV.bi];
  for (const t of LV.torches) if (inView(t.x, t.y) && Math.random() < 0.07) part({ x: t.x + frand(-2, 2), y: t.y, z: 17, vx: frand(-5, 5), vz: frand(14, 34), g: -12, life: frand(0.5, 1.2), col: fc[Math.random() < 0.5 ? 0 : 1] });
  for (const b of LV.braziers) if (b.lit && inView(b.x, b.y)) {
    if (Math.random() < 0.3) part({ x: b.x + frand(-4, 4), y: b.y + 3, z: 14, vx: frand(-8, 8), vz: frand(20, 50), g: -14, life: frand(0.6, 1.5), col: Math.random() < 0.5 ? '#ffe080' : '#ff9030' });
    if (Math.random() < 0.08) part({ x: b.x + frand(-3, 3), y: b.y + 3, z: 22, vx: frand(-4, 4), vz: frand(10, 18), g: -6, life: frand(1, 2), col: '#58505c', size: 2, em: 0 });
  }
  for (let k = 0; k < 3; k++) {
    const tx = Math.floor((cam.x + Math.random() * VW) / TS), ty = Math.floor((cam.y + Math.random() * VH) / TS), t = tileAt(tx, ty), x = tx * TS + Math.random() * TS, y = ty * TS + Math.random() * TS;
    if (t === 4 && Math.random() < 0.3) part({ x, y, z: 1, vx: frand(-6, 6), vz: frand(20, 55), g: 40, life: frand(0.5, 1.1), col: Math.random() < 0.5 ? '#ffd060' : '#ff6a20' });
    else if (t === 3 && Math.random() < 0.25) part({ x, y: y + 10, z: 0, vz: frand(8, 20), g: -4, life: frand(1, 2.2), col: ['#6a90ff', '#40e0c8', '#ff8030'][LV.bi], em: 170 });
    else if (t === 2 && Math.random() < 0.02) { flashes.push({ x, y, t: 0, max: 0.6, ring: true, col: [0, 0, 0] }); if (Math.random() < 0.5) sfx('drip', x, y); }
  }
  if (LV.stairs.open && inView(LV.stairs.x, LV.stairs.y) && Math.random() < 0.3) part({ x: LV.stairs.x + frand(-7, 7), y: LV.stairs.y + frand(-6, 6), z: 0, vz: frand(15, 40), g: -10, life: frand(0.6, 1.4), col: Math.random() < 0.5 ? '#c080ff' : '#80d0ff' });
  for (const m of motes) { m.x += Math.sin(G.time * 0.4 + m.ph) * m.s * dt; m.y += Math.cos(G.time * 0.3 + m.ph * 2) * m.s * 0.6 * dt; }
}

/* ---------- run lifecycle ---------- */
function resetHero() {
  Object.assign(pl, { hp: 100, maxHp: 100, mp: 60, maxMp: 60, lvl: 1, xp: 0, gold: 0, potions: 2, atk: 14, spell: 20, speedK: 1, crit: 0.05, arcK: 1, shots: 1, cdK: 1, regen: 5, leech: 0, lightK: 1, potK: 1, perks: {}, kills: 0 });
}
function saveRun() {
  if (DEMO) return;
  const hero = {}; HERO_KEYS.forEach(k => { hero[k] = pl[k]; });
  store.set('run', { depth: G.depth, seed: G.runSeed, altar: G.altarCost, time: G.runTime, won: G.won, hero });
  const best = store.get('best', { depth: 0, kills: 0 });
  store.set('best', { depth: Math.max(best.depth, G.depth), kills: Math.max(best.kills, pl.kills) });
}
function clearEntities() { enemies = []; bolts = []; parts = []; pickups = []; texts = []; flashes = []; slashes = []; novas = []; }
function spawnEnemy(sp) {
  const d = EDEF[sp.type], el = sp.elite ? 1 : 0;
  const e = { type: sp.type, def: d, x: sp.x, y: sp.y, z: 0, hp: d.hp * (1 + 0.2 * (G.depth - 1)) * (el ? 2.2 : 1), dmg: d.dmg * (1 + 0.1 * (G.depth - 1)) * (el ? 1.3 : 1), sp: d.sp * (1 + 0.03 * (G.depth - 1)),
    elite: !!el, ph: Math.random() * TAU, cd: 0.5 + Math.random(), state: 'idle', st: 0, wait: 0.3, awake: false, kx: 0, ky: 0, flash: 0, dir: Math.random() < 0.5 ? 1 : -1, pat: 0, cnt: 0, acc: 0, spin: 0, hx: 0, hy: 1 };
  e.maxHp = e.hp; enemies.push(e); return e;
}
function startLevel(depth) {
  G.depth = depth; G.menuMode = false;
  genLevel(depth, G.runSeed + depth * 7919);
  clearEntities(); LV.spawns.forEach(spawnEnemy);
  Object.assign(pl, { x: LV.start.x, y: LV.start.y, kx: 0, ky: 0, dx: 0, dy: 1, ang: Math.PI / 2, inv: 1, dash: 0, dashCd: 0, atkCd: 0, boltCd: 0, novaCd: 0, swing: 0, swingMax: 0.2, swingA: 0, swingDir: 1, combo: 0, comboT: 0, walk: 0, stepD: 0, lavaT: 0, dead: false, deadT: 0, wasDash: false, safe: { x: LV.start.x, y: LV.start.y } });
  G.boss = enemies.find(e => e.type === 'boss') || null; G.bossAwake = false; G.victory = false; G.pending = 0;
  G.fade = 0; G.toast = null; G.flowT = 0; G.freeze = 0;
  G.banner = { t: 0, title: 'Глубина ' + depth, sub: LV.boss ? 'Логово Стража Пепла' : LV.B.name + ' · ' + LV.B.sub };
  if (!LV.boss && !LV.braziers.length) LV.stairs.open = true;
  cam.fx = clamp(pl.x - VW / 2, 0, MW * TS - VW); cam.fy = clamp(pl.y - VH / 2, 0, MH * TS - VH);
  initMotes(); musicSet(LV.B.song); MUS.intenT = 0;
  saveRun();
}
function newGame() { G.runSeed = DEMO ? 4242 : (Date.now() & 0xfffffff); G.runTime = 0; G.altarCost = 60; G.won = false; resetHero(); startLevel(1); }
function continueGame() {
  const s = store.get('run', null); if (!s) return newGame();
  resetHero(); Object.assign(pl, s.hero); G.runSeed = s.seed; G.altarCost = s.altar; G.runTime = s.time || 0; G.won = !!s.won; startLevel(s.depth);
}
// A living dungeon behind the main menu: lit braziers, wandering monsters, a gliding camera.
function startMenuScene() {
  G.menuMode = true; G.depth = [1, 3, 5][Math.floor(Math.random() * 3)];
  genLevel(G.depth, (Math.random() * 1e9) | 0);
  clearEntities(); LV.spawns.forEach(spawnEnemy); LV.braziers.forEach(b => { b.lit = true; b.t = 5; });
  Object.assign(pl, { x: -9999, y: -9999, dead: false });
  G.fade = 0; G.boss = null; G.bossAwake = false; G.banner = null; G.toast = null; G.prompt = null; G.time = Math.random() * 100;
  cam.fx = LV.rooms[0].cx * TS - VW / 2; cam.fy = LV.rooms[0].cy * TS - VH / 2; initMotes();
}
function updateCam(dt) {
  let tx, ty, k = 1 - Math.pow(0.0015, dt);
  if (G.menuMode) { const R = LV.rooms, t = G.time * 0.05, i = Math.floor(t) % R.length, j = (i + 1) % R.length, f = t % 1, s = f * f * (3 - 2 * f); tx = lerp(R[i].cx, R[j].cx, s) * TS; ty = lerp(R[i].cy, R[j].cy, s) * TS; k = 1 - Math.pow(0.2, dt); }
  else { tx = pl.x + Math.cos(pl.ang) * 16; ty = pl.y - 8 + Math.sin(pl.ang) * 10; }
  cam.fx = clamp(cam.fx + (tx - VW / 2 - cam.fx) * k, 0, MW * TS - VW); cam.fy = clamp(cam.fy + (ty - VH / 2 - cam.fy) * k, 0, MH * TS - VH);
}

/* ---------- movement ---------- */
function moveEnt(e, dx, dy, fly, ghost) {
  if (ghost) { e.x = clamp(e.x + dx, 24, MW * TS - 24); e.y = clamp(e.y + dy, 24, MH * TS - 24); return false; }
  let hit = false;
  e.x += dx; if (blocked(e.x, e.y, fly)) { e.x -= dx; hit = true; }
  e.y += dy; if (blocked(e.x, e.y, fly)) { e.y -= dy; hit = true; }
  return hit;
}
function pushSolids(e, r, fly) {
  for (const o of G.solids) {
    const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), m = o.r + r;
    if (d < m && d > 0.01) { const nx = e.x + dx / d * (m - d), ny = e.y + dy / d * (m - d); if (!blocked(nx, ny, fly)) { e.x = nx; e.y = ny; } }
  }
}

/* ---------- input ---------- */
function humanInput() {
  const k = c => keys.has(c) ? 1 : 0;
  const i = { mx: k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft'), my: k('KeyS') + k('ArrowDown') - k('KeyW') - k('ArrowUp') };
  i.ang = mouse.used ? Math.atan2(mouse.y + cam.y - (pl.y - 7), mouse.x + cam.x - pl.x) : (i.mx || i.my) ? Math.atan2(i.my, i.mx) : pl.ang;
  i.atk = mouse.l || keys.has('KeyJ'); i.bolt = mouse.r || keys.has('KeyK');
  i.dash = pressed.has('Space') || pressed.has('ShiftLeft'); i.nova = pressed.has('KeyQ'); i.potion = pressed.has('KeyR'); i.use = pressed.has('KeyE');
  return i;
}
// Autoplay for ?demo: paths to the next brazier / stairs and fights what it sees.
function botInput() {
  const i = { mx: 0, my: 0, ang: pl.ang, atk: false, bolt: false, dash: false, nova: false, potion: pl.hp < pl.maxHp * 0.45, use: true };
  let tg = LV.braziers.find(b => !b.lit && !b.auto) || (LV.stairs.open ? LV.stairs : G.boss || LV.stairs);
  let bd = 150, be = null, near = 0;
  for (const e of enemies) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < 60) near++; if (d < bd && !e.phased && los(pl.x, pl.y, e.x, e.y)) { bd = d; be = e; } }
  if (!G.botFlow || G.botKey !== tg || G.time - G.botT > 0.4) { G.botFlow = flood(LV, Math.floor(tg.x / TS), Math.floor(tg.y / TS)); G.botKey = tg; G.botT = G.time; }
  const D = G.botFlow, c = Math.floor(pl.y / TS) * MW + Math.floor(pl.x / TS);
  let gx = tg.x, gy = tg.y;
  if (D[c] > 1) { let best = c; for (const o of [-1, 1, -MW, MW]) if (D[c + o] >= 0 && D[c + o] < D[best]) best = c + o; gx = (best % MW) * TS + 8; gy = Math.floor(best / MW) * TS + 8; }
  let l = Math.hypot(gx - pl.x, gy - pl.y) || 1; i.mx = (gx - pl.x) / l; i.my = (gy - pl.y) / l;
  if (be) {
    i.ang = Math.atan2(be.y - pl.y, be.x - pl.x);
    if (bd < 30) i.atk = true; else if (pl.mp > 14) i.bolt = true; else { i.mx = Math.cos(i.ang); i.my = Math.sin(i.ang); }
    if (bd < 44 && pl.mp > 14 && be.type !== 'bat') { i.mx = -Math.cos(i.ang); i.my = -Math.sin(i.ang); }
    if (near >= 3 && pl.mp >= 30) i.nova = true;
  }
  return i;
}

/* ---------- hero ---------- */
function hurtPlayer(dmg, fx, fy, o = {}) {
  if (pl.dead || G.menuMode || pl.inv > 0 || (pl.dash > 0 && !o.force)) return false;
  dmg = Math.round(dmg); pl.hp = Math.max(0, pl.hp - dmg); pl.inv = 0.7; G.hurtFx = 1; shake(5); sfx('hurt');
  const l = Math.hypot(pl.x - fx, pl.y - fy) || 1; pl.kx = (pl.x - fx) / l * 150; pl.ky = (pl.y - fy) / l * 150;
  burst(pl.x, pl.y, 8, '#ff4a4a', 10, 70, 120); addText(pl.x, pl.y - 20, '-' + dmg, '#ff5a5a');
  if (pl.hp <= 0) {
    pl.dead = true; pl.deadT = 0; sfx('death'); burst(pl.x, pl.y, 8, '#4a6cc0', 30, 100); burst(pl.x, pl.y, 8, '#ffb040', 20, 80); G.freeze = 0.12; shake(8);
    store.del('run'); const best = store.get('best', { depth: 0, kills: 0 }); store.set('best', { depth: Math.max(best.depth, G.depth), kills: Math.max(best.kills, pl.kills) });
  }
  return true;
}
function heal(v) { v = Math.round(v); pl.hp = Math.min(pl.maxHp, pl.hp + v); addText(pl.x, pl.y - 22, '+' + v, '#70ff80'); for (let i = 0; i < 8; i++) part({ x: pl.x + frand(-6, 6), y: pl.y + frand(-3, 3), z: 2, vz: frand(20, 50), g: -8, life: frand(0.5, 1), col: '#70ff80' }); }
function gainXp(v) {
  pl.xp += v; sfx('xp');
  while (pl.xp >= xpNeed(pl.lvl)) { pl.xp -= xpNeed(pl.lvl); pl.lvl++; pl.maxHp += 6; pl.hp = Math.min(pl.maxHp, pl.hp + 20); G.pending++; G.levelFx = true; }
}
function pickPerks(n) {
  const pool = PERKS.filter(p => (pl.perks[p.id] || 0) < (p.max || 5));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}
function takePerk(p) { p.f(); pl.perks[p.id] = (pl.perks[p.id] || 0) + 1; G.pending = Math.max(0, G.pending - 1); sfx('perk'); G.flash = 0.4; }

function meleeAttack() {
  pl.combo = pl.comboT > 0 ? (pl.combo + 1) % 3 : 0; pl.comboT = 0.75;
  const heavy = pl.combo === 2, range = (heavy ? 31 : 25) * pl.arcK, arc = Math.min(2.6, (heavy ? 1.5 : 1.15) * pl.arcK);
  pl.atkCd = heavy ? 0.44 : 0.3; pl.swing = pl.swingMax = heavy ? 0.26 : 0.2; pl.swingA = pl.ang; pl.swingDir = pl.combo === 1 ? -1 : 1;
  sfx(heavy ? 'swing3' : 'swing');
  slashes.push({ x: pl.x, y: pl.y, ang: pl.ang, dir: pl.swingDir, t: 0, max: heavy ? 0.2 : 0.15, range, arc, heavy });
  pl.kx += Math.cos(pl.ang) * 50; pl.ky += Math.sin(pl.ang) * 50;
  let hits = 0;
  const inArc = (x, y, r) => { const dx = x - pl.x, dy = y - pl.y, d = Math.hypot(dx, dy); return d < range + r && (d < 9 || angDiff(Math.atan2(dy, dx), pl.ang) < arc); };
  for (const e of enemies) if (!e.dead && !e.phased && inArc(e.x, e.y, e.def.r)) {
    const crit = Math.random() < pl.crit; hits++;
    hitEnemy(e, pl.atk * (heavy ? 1.6 : 1) * (crit ? 2 : 1) * frand(0.9, 1.1), pl.ang, heavy ? 260 : 150, crit);
    pl.mp = Math.min(pl.maxMp, pl.mp + 3);
  }
  for (const p of LV.props) if (!p.dead && p.kind !== 'chest' && p.kind !== 'altar' && inArc(p.x, p.y, 5)) { breakProp(p); hits++; }
  for (const b of bolts) if (!b.mine && inArc(b.x, b.y, 5)) {   // parry: send the projectile back
    const s = Math.hypot(b.vx, b.vy) * 1.8; b.mine = true; b.vx = Math.cos(pl.ang) * s; b.vy = Math.sin(pl.ang) * s; b.dmg = pl.atk * 1.5; b.life = 1.2; hits++;
    addText(b.x, b.y - 12, 'Отражено', '#80d0ff'); sfx('crit', b.x, b.y);
  }
  if (hits) { G.freeze = heavy ? 0.07 : 0.035; shake(heavy ? 4 : 2); }
}
function castBolt() {
  if (pl.mp < 10) { pl.boltCd = 0.4; sfx('deny'); return; }
  pl.mp -= 10; pl.boltCd = 0.34 * pl.cdK; sfx('bolt');
  for (let i = 0; i < pl.shots; i++) { const a = pl.ang + (i - (pl.shots - 1) / 2) * 0.17; bolts.push({ x: pl.x + Math.cos(a) * 8, y: pl.y + Math.sin(a) * 8, vx: Math.cos(a) * 215, vy: Math.sin(a) * 215, life: 1.2, mine: true, dmg: pl.spell * (pl.shots > 1 ? 0.8 : 1), r: 3 }); }
}
function castNova() {
  if (pl.novaCd > 0 || pl.mp < 30) { sfx('deny'); return; }
  pl.mp -= 30; pl.novaCd = 7 * pl.cdK; sfx('nova'); G.flash = 0.55; shake(7); G.freeze = 0.05;
  novas.push({ x: pl.x, y: pl.y, t: 0 }); flashes.push({ x: pl.x, y: pl.y, t: 0, max: 0.5, r: 190, col: [1, 0.6, 0.25] });
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; part({ x: pl.x, y: pl.y, z: 5, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, vz: 10, g: 60, life: 0.45, col: i % 2 ? '#ffe080' : '#ff8030', size: 2 }); }
  for (const e of enemies) { const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < 66 + e.def.r && !e.phased) hitEnemy(e, pl.spell * 2.2, Math.atan2(e.y - pl.y, e.x - pl.x), 330, false); }
  for (const b of bolts) if (!b.mine && Math.hypot(b.x - pl.x, b.y - pl.y) < 70) b.life = 0;
  for (const p of LV.props) if (!p.dead && p.kind !== 'chest' && p.kind !== 'altar' && Math.hypot(p.x - pl.x, p.y - pl.y) < 60) breakProp(p);
}
function drinkPotion() {
  if (pl.potions <= 0 || pl.hp >= pl.maxHp) { sfx('deny'); return; }
  pl.potions--; sfx('potion'); sfx('heal'); heal(45 * pl.potK);
}

function updatePlayer(dt) {
  if (pl.dead) { pl.deadT += dt; return; }
  const inp = G.inp = DEMO ? botInput() : humanInput();
  pl.ang = inp.ang;
  for (const k of ['inv', 'atkCd', 'boltCd', 'novaCd', 'dashCd', 'dash', 'swing', 'comboT']) pl[k] -= dt;
  pl.mp = Math.min(pl.maxMp, pl.mp + pl.regen * dt);
  const l = Math.hypot(inp.mx, inp.my);
  if (l > 0) { pl.dx = inp.mx / l; pl.dy = inp.my / l; }
  if (inp.dash && pl.dashCd <= 0) {
    if (!l) { pl.dx = Math.cos(pl.ang); pl.dy = Math.sin(pl.ang); }
    pl.dash = 0.18; pl.dashCd = 0.85 * pl.cdK; pl.safe = { x: pl.x, y: pl.y }; sfx('dash');
  }
  const dashing = pl.dash > 0, tile = tileAtPx(pl.x, pl.y);
  const sp = dashing ? 250 : l > 0 ? 78 * pl.speedK * (tile === 2 ? 0.68 : 1) * (pl.swing > 0 ? 0.55 : 1) : 0;
  const ox = pl.x, oy = pl.y;
  moveEnt(pl, (pl.dx * sp + pl.kx) * dt, (pl.dy * sp + pl.ky) * dt, dashing);
  pl.kx *= 0.84; pl.ky *= 0.84;
  if (dashing) part({ x: pl.x + frand(-3, 3), y: pl.y, z: 4 + Math.random() * 10, life: 0.25, g: 0, col: Math.random() < 0.5 ? '#9ab0ff' : '#ffd080', size: 2 });
  else {
    pushSolids(pl, 4, false);
    if (pl.wasDash && blocked(pl.x, pl.y, false)) {   // a dash may end over a pit or clipping its rim
      let ok = false;
      if (tileAtPx(pl.x, pl.y) !== 3) for (let r = 1; r <= 8 && !ok; r++) for (let a = 0; a < 8 && !ok; a++) { const nx = pl.x + Math.cos(a * TAU / 8) * r, ny = pl.y + Math.sin(a * TAU / 8) * r; if (!blocked(nx, ny, false)) { pl.x = nx; pl.y = ny; ok = true; } }
      if (!ok) { burst(pl.x, pl.y, 0, '#8090c0', 12, 40); pl.x = pl.safe.x; pl.y = pl.safe.y; pl.inv = 0; hurtPlayer(12, pl.x, pl.y + 1, { force: true }); toast('Вы сорвались в пропасть'); }
    }
  }
  pl.wasDash = dashing;
  const moved = Math.hypot(pl.x - ox, pl.y - oy);
  if (l > 0 && moved > 0.2) {
    pl.walk += dt * 9; pl.stepD += moved;
    if (pl.stepD > 20 && !dashing) { pl.stepD = 0; sfx(tile === 2 ? 'wade' : 'step'); if (tile === 2) flashes.push({ x: pl.x, y: pl.y + 1, t: 0, max: 0.5, ring: true, col: [0, 0, 0] }); else part({ x: pl.x, y: pl.y + 1, z: 0, vz: 12, life: 0.35, col: '#8a8494', em: 0, g: 30 }); }
  } else pl.walk = 0;
  if (tile === 4 && !dashing) {
    pl.lavaT -= dt;
    if (pl.lavaT <= 0) { pl.lavaT = 0.5; pl.inv = 0; hurtPlayer(9, pl.x, pl.y, { force: true }); pl.kx = pl.ky = 0; burst(pl.x, pl.y, 4, '#ff8030', 8, 40); }
  } else pl.lavaT = 0;
  if (inp.atk && pl.atkCd <= 0) meleeAttack();
  if (inp.bolt && pl.boltCd <= 0) castBolt();
  if (inp.nova) castNova();
  if (inp.potion) drinkPotion();
}

/* ---------- enemies ---------- */
function wake(e) {
  if (e.awake) return;
  e.awake = true; addText(e.x, e.y - 20, '!', '#ffd24a', true);
  for (const o of enemies) if (!o.awake && o.type !== 'boss' && Math.hypot(o.x - e.x, o.y - e.y) < 70) o.awake = true;
}
function wakeBoss() {
  if (G.bossAwake || !G.boss) return;
  G.bossAwake = true; G.boss.awake = true; sfx('roar'); shake(8); musicSet('boss');
  G.banner = { t: 0, title: 'Страж Пепла', sub: 'Он ждал того, кто несёт Искру' };
  LV.braziers.forEach((b, i) => { if (b.auto && !b.lit) { b.lit = true; b.t = -i * 0.25; flashes.push({ x: b.x, y: b.y, t: 0, max: 0.5, r: 120, col: [1, 0.6, 0.2] }); } });
  sfx('brazier');
}
function hitEnemy(e, dmg, ang, knock, crit) {
  if (e.dead) return;
  if (e.type === 'boss') wakeBoss();
  dmg = Math.max(1, Math.round(dmg)); e.hp -= dmg; e.flash = 0.12; wake(e);
  const kr = e.type === 'boss' ? 0.06 : e.elite ? 0.5 : 1;
  e.kx += Math.cos(ang) * knock * kr; e.ky += Math.sin(ang) * knock * kr;
  addText(e.x + frand(-4, 4), e.y - 16 - e.z, dmg, crit ? '#ffd24a' : '#ffffff', crit);
  sfx(crit ? 'crit' : 'hit', e.x, e.y); burst(e.x, e.y, 8, ecol(e), 6, 70, 60);
  if (e.hp <= 0) killEnemy(e);
}
function drop(type, x, y, v = 1) { const a = Math.random() * TAU, s = 20 + Math.random() * 50; pickups.push({ type, x, y, z: 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: 60 + Math.random() * 50, v, t: 0 }); }
function killEnemy(e) {
  e.dead = true; pl.kills++; sfx('kill', e.x, e.y);
  const big = e.type === 'boss', k = e.elite ? 2.5 : 1;
  burst(e.x, e.y, 8, ecol(e), big ? 80 : 18, big ? 160 : 90, 90); flashes.push({ x: e.x, y: e.y, t: 0, max: 0.3, r: big ? 200 : 60, col: [1, 0.7, 0.4] });
  const orbs = big ? 14 : e.elite ? 5 : 2; for (let i = 0; i < orbs; i++) drop('xp', e.x, e.y, Math.ceil(e.def.xp * k / orbs));
  const coins = big ? 20 : Math.random() < 0.6 ? Math.ceil(Math.random() * e.def.gold * k) : 0; for (let i = 0; i < coins; i++) drop('coin', e.x, e.y, big ? 3 : 1);
  const r = Math.random(); if (big || e.elite) { drop('heart', e.x, e.y); drop('potion', e.x, e.y); } else if (r < 0.07) drop('heart', e.x, e.y); else if (r < 0.15) drop('mana', e.x, e.y); else if (r < 0.17) drop('potion', e.x, e.y);
  if (pl.leech && !pl.dead) pl.hp = Math.min(pl.maxHp, pl.hp + pl.leech);
  if (big) {
    G.bossAwake = false; G.boss = null; LV.stairs.open = true; G.freeze = 0.25; shake(10); G.flash = 0.8; sfx('victory'); sfx('seal'); musicSet(LV.B.song);
    for (const o of enemies) if (o !== e) { o.hp = 0; o.dead = true; burst(o.x, o.y, 8, ecol(o), 14, 80, 90); }
    bolts = bolts.filter(b => b.mine); toast('Страж Пепла повержен — спуск открыт');
  }
}
const enemyShot = (e, ang, sp, dmg) => bolts.push({ x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 4, mine: false, dmg: dmg || e.dmg, r: 3 });
// Walkers follow the flow field around walls and pits; flyers and close targets go straight.
function seek(e, nx, ny, dist) {
  if (e.def.fly || dist < 26 || !G.flow) return [nx, ny];
  const F = G.flow, c = Math.floor(e.y / TS) * MW + Math.floor(e.x / TS);
  if (F[c] < 0) return [nx, ny];
  let best = c, bs = -9;
  for (const [o, ox, oy] of [[-1, -1, 0], [1, 1, 0], [-MW, 0, -1], [MW, 0, 1]]) if (F[c + o] >= 0 && F[c + o] < F[c]) { const s = ox * nx + oy * ny; if (s > bs) { bs = s; best = c + o; } }
  const gx = (best % MW) * TS + 8 - e.x, gy = Math.floor(best / MW) * TS + 8 - e.y, l = Math.hypot(gx, gy) || 1;
  return [gx / l, gy / l];
}
const AI = {
  slime(e, dt, dist, nx, ny) {
    if (e.state !== 'hop') { e.z = 0; if (e.st > e.wait) { e.state = 'hop'; e.st = 0; [e.hx, e.hy] = seek(e, nx, ny, dist); } return [0, 0]; }
    const t = e.st / 0.42; e.z = Math.sin(Math.PI * Math.min(1, t)) * 7;
    if (t >= 1) { e.state = 'idle'; e.st = 0; e.wait = 0.2 + Math.random() * 0.35; e.z = 0; part({ x: e.x, y: e.y + 1, vz: 10, life: 0.3, col: '#8a8494', em: 0, g: 30 }); }
    return [e.hx * e.sp * 2.4, e.hy * e.sp * 2.4];
  },
  bat(e, dt, dist, nx, ny) { const w = Math.sin(G.time * 5 + e.ph) * 0.9; return [(nx - ny * w) * e.sp, (ny + nx * w) * e.sp]; },
  skel(e, dt, dist, nx, ny) {
    if (e.state === 'wind') { if (e.st > 0.42) { e.state = 'lunge'; e.st = 0; sfx('swing', e.x, e.y); } return [0, 0]; }
    if (e.state === 'lunge') { if (e.st > 0.22) { e.state = 'rest'; e.st = 0; } return [e.hx * 190, e.hy * 190]; }
    if (e.state === 'rest') { if (e.st > 0.55) { e.state = 'idle'; e.st = 0; } return [0, 0]; }
    if (dist < 36 && los(e.x, e.y, pl.x, pl.y)) { e.state = 'wind'; e.st = 0; e.hx = nx; e.hy = ny; return [0, 0]; }
    const [sx, sy] = seek(e, nx, ny, dist); return [sx * e.sp, sy * e.sp];
  },
  cult(e, dt, dist, nx, ny) {
    if (e.state === 'cast') {
      if (e.st > 0.6) { const a = Math.atan2(ny, nx), n = G.depth >= 4 || e.elite ? 3 : 1; for (let i = 0; i < n; i++) enemyShot(e, a + (i - (n - 1) / 2) * 0.24, 84); sfx('shot', e.x, e.y); e.state = 'idle'; e.cd = 1.7 + Math.random() * 0.7; }
      return [0, 0];
    }
    if (e.cd <= 0 && dist < 170 && los(e.x, e.y, pl.x, pl.y)) { e.state = 'cast'; e.st = 0; sfx('charge', e.x, e.y); return [0, 0]; }
    if (dist > 112) { const [sx, sy] = seek(e, nx, ny, dist); return [sx * e.sp, sy * e.sp]; }
    if (dist < 64) return [-nx * e.sp, -ny * e.sp];
    return [-ny * e.sp * 0.6 * e.dir, nx * e.sp * 0.6 * e.dir];
  },
  wraith(e, dt, dist, nx, ny) { e.phased = (e.st + e.ph) % 4.4 > 3.2; const s = e.sp * (e.phased ? 1.9 : 1); return [nx * s, ny * s]; },
  boss(e, dt, dist, nx, ny) {
    const rage = e.hp < e.maxHp * 0.5;
    if (rage && !e.raged) { e.raged = true; sfx('roar', e.x, e.y); shake(7); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU, m = spawnEnemy({ type: 'skel', x: e.x + Math.cos(a) * 44, y: e.y + Math.sin(a) * 34 }); m.awake = true; burst(m.x, m.y, 4, '#ff8030', 14, 60); } }
    const idle = () => { e.state = 'idle'; e.st = 0; };
    if (e.state === 'ring') {
      const n = Math.floor(e.st / 0.45);
      if (n > e.cnt && n <= (rage ? 3 : 2)) { e.cnt = n; for (let i = 0; i < 14; i++) enemyShot(e, i / 14 * TAU + n * 0.22, 74, e.dmg * 0.6); sfx('shot', e.x, e.y); shake(2); }
      if (e.st > 1.9) idle(); return [0, 0];
    }
    if (e.state === 'charge') {
      if (e.st < 0.7) { e.hx = nx; e.hy = ny; return [0, 0]; }
      if (e.st > 1.3 || (e.hitWall && e.st > 0.76)) { idle(); shake(6); sfx('boltHit', e.x, e.y); burst(e.x + e.hx * 12, e.y + e.hy * 12, 4, '#8a8090', 20, 90, 0); }
      return [e.hx * 240, e.hy * 240];
    }
    if (e.state === 'spiral') {
      e.acc += dt;
      while (e.acc > (rage ? 0.075 : 0.105)) { e.acc -= rage ? 0.075 : 0.105; e.spin += 0.42; enemyShot(e, e.spin, 78, e.dmg * 0.6); if (rage) enemyShot(e, e.spin + Math.PI, 78, e.dmg * 0.6); if (Math.random() < 0.3) sfx('shot', e.x, e.y); }
      if (e.st > 2.4) idle(); return [0, 0];
    }
    if (e.st > (rage ? 0.9 : 1.5)) { e.pat = (e.pat + 1) % 3; e.state = ['ring', 'charge', 'spiral'][e.pat]; e.st = 0; e.cnt = 0; e.acc = 0; if (e.state === 'charge') sfx('charge', e.x, e.y); }
    return [nx * e.sp, ny * e.sp];
  },
};
function updateEnemies(dt) {
  if (!G.menuMode) { G.flowT -= dt; if (G.flowT <= 0) { G.flow = flood(LV, Math.floor(pl.x / TS), Math.floor(pl.y / TS)); G.flowT = 0.3; } }
  let danger = 0;
  for (const e of enemies) {
    e.flash -= dt; e.cd -= dt; e.st += dt;
    const dx = pl.x - e.x, dy = pl.y - e.y, dist = Math.hypot(dx, dy) || 1, nx = dx / dist, ny = dy / dist;
    let vx = 0, vy = 0;
    if (G.menuMode) {   // idle wandering behind the menu
      if (e.cd <= 0) { e.cd = 1 + Math.random() * 3; const a = Math.random() * TAU; e.hx = Math.cos(a); e.hy = Math.sin(a); e.wander = Math.random() < 0.6; }
      if (e.wander && e.type !== 'boss') { vx = e.hx * e.sp * 0.4; vy = e.hy * e.sp * 0.4; }
    } else {
      if (!e.awake && e.type !== 'boss' && dist < 140 && (dist < 44 || los(e.x, e.y, pl.x, pl.y))) wake(e);
      if (e.type === 'boss' && !G.bossAwake && dist < 150 && los(e.x, e.y, pl.x, pl.y)) wakeBoss();
      if (e.awake && !pl.dead) { if (dist < 240) danger++; [vx, vy] = AI[e.type](e, dt, dist, nx, ny); }
    }
    for (const o of enemies) if (o !== e) { const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), m = e.def.r + o.def.r; if (od < m && od > 0) { vx += ox / od * 40; vy += oy / od * 40; } }
    e.hitWall = moveEnt(e, (vx + e.kx) * dt, (vy + e.ky) * dt, e.def.fly, e.def.ghost);
    if (!e.def.fly && e.type !== 'boss') pushSolids(e, 4, false);
    e.kx *= 0.86; e.ky *= 0.86;
    if (e.awake && !e.phased && dist < e.def.r + 5) hurtPlayer(e.dmg * (e.state === 'lunge' || e.state === 'charge' ? 1.3 : 1), e.x, e.y);
  }
  enemies = enemies.filter(e => !e.dead);
  if (!G.menuMode) MUS.intenT = G.bossAwake || danger > 0 ? 1 : 0;
}

function updateBolts(dt) {
  for (const b of bolts) {
    b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
    let hit = wallAt(b.x, b.y);
    if (b.mine) {
      for (const e of enemies) if (!hit && !e.dead && !e.phased && Math.hypot(e.x - b.x, e.y - b.y) < e.def.r + b.r) { const crit = Math.random() < pl.crit; hit = true; hitEnemy(e, b.dmg * (crit ? 2 : 1) * frand(0.9, 1.1), Math.atan2(b.vy, b.vx), 120, crit); }
      for (const p of LV.props) if (!hit && !p.dead && p.kind !== 'chest' && p.kind !== 'altar' && Math.hypot(p.x - b.x, p.y - b.y) < 7) { hit = true; breakProp(p); }
    } else if (!pl.dead && pl.dash <= 0 && Math.hypot(pl.x - b.x, pl.y - b.y) < 6) { if (hurtPlayer(b.dmg, b.x - b.vx, b.y - b.vy)) hit = true; }
    if (Math.random() < 0.6) part({ x: b.x, y: b.y, z: 7, vx: frand(-8, 8), vy: frand(-8, 8), life: 0.22, g: 0, col: b.mine ? '#ff9030' : '#d040d0' });
    if (hit) { b.life = 0; burst(b.x, b.y, 7, b.mine ? '#ffb040' : '#ff4ae0', 8, 60); flashes.push({ x: b.x - b.vx * dt, y: b.y - b.vy * dt, t: 0, max: 0.18, r: 60, col: b.mine ? [1, 0.6, 0.2] : [1, 0.2, 0.9] }); sfx('boltHit', b.x, b.y); }
  }
  bolts = bolts.filter(b => b.life > 0);
}

function updatePickups(dt) {
  for (const p of pickups) {
    p.t += dt; p.vz -= 300 * dt; p.z += p.vz * dt;
    if (p.z < 0) { p.z = 0; p.vz *= -0.4; p.vx *= 0.6; p.vy *= 0.6; }
    const d = Math.hypot(pl.x - p.x, pl.y - p.y) || 1, can = !pl.dead && !G.menuMode && (p.type === 'heart' ? pl.hp < pl.maxHp : p.type === 'mana' ? pl.mp < pl.maxMp - 1 : p.type === 'potion' ? pl.potions < 9 : true);
    if (can && p.t > 0.4 && d < (p.type === 'xp' ? 80 : 44)) { const s = 200 * Math.min(1, p.t); p.vx = (pl.x - p.x) / d * s; p.vy = (pl.y - p.y) / d * s; }
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (!wallAt(nx, p.y)) p.x = nx; if (!wallAt(p.x, ny)) p.y = ny;
    p.vx *= 0.93; p.vy *= 0.93;
    if (can && p.t > 0.3 && d < 9) {
      p.dead = true;
      if (p.type === 'coin') { pl.gold += p.v; sfx('coin'); }
      else if (p.type === 'xp') gainXp(p.v);
      else if (p.type === 'heart') { sfx('heal'); heal(20); }
      else if (p.type === 'mana') { sfx('mana'); pl.mp = Math.min(pl.maxMp, pl.mp + 25); addText(pl.x, pl.y - 22, '+25', '#70b0ff'); }
      else if (p.type === 'potion') { sfx('potion'); pl.potions++; addText(pl.x, pl.y - 22, '+зелье', '#ff90a0'); }
    }
  }
  pickups = pickups.filter(p => !p.dead);
}

/* ---------- world objects ---------- */
function breakProp(p) {
  p.dead = true; sfx('break', p.x, p.y);
  burst(p.x, p.y, 5, p.kind === 'urn' ? '#b8785a' : '#96643a', 12, 70, 0); burst(p.x, p.y, 5, '#5e4022', 6, 50, 0);
  const r = Math.random(); if (r < 0.5) for (let i = 1 + Math.floor(Math.random() * 3); i > 0; i--) drop('coin', p.x, p.y); else if (r < 0.57) drop('heart', p.x, p.y); else if (r < 0.66) drop('mana', p.x, p.y);
}
function lightBrazier(b) {
  b.lit = true; b.t = 0; sfx('brazier', b.x, b.y); G.flash = 0.3; shake(3);
  burst(b.x, b.y, 12, '#ffd060', 30, 110); flashes.push({ x: b.x, y: b.y, t: 0, max: 0.6, r: 170, col: [1, 0.7, 0.3] });
  heal(15); pl.mp = Math.min(pl.maxMp, pl.mp + 25);
  const left = LV.braziers.filter(o => !o.lit).length;
  if (!left) { LV.stairs.open = true; sfx('seal'); shake(5); toast('Печать снята — спуск открыт'); } else toast('Жаровня зажжена · осталось ' + left);
}
function openChest(p) {
  p.open = true; sfx('chest', p.x, p.y); burst(p.x, p.y, 8, '#ffd24a', 24, 90);
  for (let i = (p.big ? 14 : 7) + Math.floor(Math.random() * 6); i > 0; i--) drop('coin', p.x, p.y, 2);
  if (p.big || Math.random() < 0.5) drop('potion', p.x, p.y);
  drop(Math.random() < 0.5 ? 'heart' : 'mana', p.x, p.y);
}
function useAltar() {
  if (pl.gold < G.altarCost) { sfx('deny'); toast('Алтарю нужно ' + G.altarCost + ' золота'); return; }
  pl.gold -= G.altarCost; G.altarCost = Math.round(G.altarCost * 1.6); G.pending++; sfx('seal');
}
function descend() {
  if (LV.boss && !G.won) { G.won = true; G.victory = true; sfx('victory'); return; }
  sfx('descend'); pl.hp = Math.min(pl.maxHp, pl.hp + 15); startLevel(G.depth + 1);
}
function updateWorld(dt) {
  G.solids = [];
  for (const b of LV.braziers) { if (b.lit) b.t += dt; G.solids.push({ x: b.x, y: b.y + 1, r: 7 }); }
  for (const p of LV.props) if (!p.dead) G.solids.push({ x: p.x, y: p.y, r: p.kind === 'chest' || p.kind === 'altar' ? 8 : 5.5 });
  G.prompt = null;
  if (pl.dead) return;
  let best = 24, act = null;
  const near = (o, text, f) => { const d = Math.hypot(o.x - pl.x, o.y - pl.y); if (d < best) { best = d; act = { text, f }; } };
  for (const b of LV.braziers) if (!b.lit && !b.auto) near(b, 'Зажечь жаровню', () => lightBrazier(b));
  for (const p of LV.props) { if (p.kind === 'chest' && !p.open) near(p, 'Открыть сундук', () => openChest(p)); if (p.kind === 'altar') near(p, 'Алтарь Искры: усиление за ' + G.altarCost + ' золота', useAltar); }
  if (act) { G.prompt = act.text; if (G.inp.use && !(DEMO && act.f === useAltar && pl.gold < G.altarCost)) act.f(); }
  for (const s of LV.spikes) {
    const c = (G.time + s.ph) % 2.6, cx = s.tx * TS + 8, cy = s.ty * TS + 8; s.up = c > 2.0; s.warn = c > 1.55 && !s.up;
    if (s.up && !s.was) sfx('spike', cx, cy); s.was = s.up;
    if (s.up && pl.dash <= 0 && Math.abs(pl.x - cx) < 10 && Math.abs(pl.y - cy) < 8) hurtPlayer(12, cx, cy + 0.5);
  }
  const st = LV.stairs;
  if (Math.hypot(st.x - pl.x, st.y - pl.y) < 9) {
    if (st.open) descend(); else if (G.msgCd <= 0) { toast(LV.boss ? 'Печать держит Страж Пепла' : 'Спуск запечатан: зажгите все жаровни'); G.msgCd = 2.5; sfx('deny'); }
  }
  G.seenT -= dt;
  if (G.seenT <= 0) { G.seenT = 0.2; const tx = Math.floor(pl.x / TS), ty = Math.floor(pl.y / TS); for (let j = -6; j <= 6; j++) for (let i = -8; i <= 8; i++) { const x = tx + i, y = ty + j; if (x >= 0 && y >= 0 && x < MW && y < MH && i * i + j * j * 1.6 < 70) LV.seen[y * MW + x] = 1; } }
}

function tick(dt) {
  G.time += dt;
  G.shake = Math.max(0, G.shake - dt * 22); G.hurtFx = Math.max(0, G.hurtFx - dt * 1.8); G.flash = Math.max(0, G.flash - dt * 2.5);
  G.fade = Math.min(1, G.fade + dt * 1.2); G.msgCd -= dt;
  if (G.banner) { G.banner.t += dt; if (G.banner.t > 4.2) G.banner = null; }
  if (G.toast) { G.toast.t -= dt; if (G.toast.t <= 0) G.toast = null; }
  updateParts(dt); ambientFx(dt);
  if (G.freeze > 0) { G.freeze -= dt; return; }   // hit-stop
  if (!G.menuMode) { G.runTime += dt; updatePlayer(dt); updateWorld(dt); }
  updateEnemies(dt); updateBolts(dt); updatePickups(dt); updateCam(dt);
}
