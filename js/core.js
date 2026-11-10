'use strict';
/* ИСКРА БЕЗДНЫ — core: constants, helpers, settings, input */
const VW = 384, VH = 216, TS = 16, WALL_H = 14, MW = 56, MH = 40, UW = 1920, UH = 1080;
const TAU = Math.PI * 2;
const params = new URLSearchParams(location.search), DEMO = params.has('demo');

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const lerp = (a, b, t) => a + (b - a) * t;
const hsh = (x, y) => { let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Seeded RNG drives level generation; Math.random is used only for cosmetic effects.
let seed = 1;
const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const ri = n => Math.floor(rnd() * n);
const rr = (a, b) => a + rnd() * (b - a);
const pick = arr => arr[ri(arr.length)];
const frand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const rgb = (c, k = 1) => `rgb(${clamp(Math.round(c[0] * k), 0, 255)},${clamp(Math.round(c[1] * k), 0, 255)},${clamp(Math.round(c[2] * k), 0, 255)})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hexc = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const store = {
  get(k, d) { try { const v = localStorage.getItem('iskra.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('iskra.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('iskra.' + k); } catch (e) {} },
};
const SET = Object.assign({ master: 0.8, music: 0.6, sfx: 0.8, quality: 2, bloom: true, crt: false, shake: true, dither: true, dmgNums: true }, store.get('settings', {}));
const saveSettings = () => store.set('settings', SET);

/* ---------- input ---------- */
const wrap = document.getElementById('wrap'), hudCv = document.getElementById('hud');
// `pressed` feeds the fixed-step simulation, `uiKeys` the per-frame UI; each is cleared by its consumer.
const keys = new Set(), pressed = new Set(), uiKeys = new Set();
const mouse = { x: VW / 2, y: VH / 2, ux: 0, uy: 0, l: false, r: false, lp: false, rp: false, click: false, used: false };

addEventListener('keydown', e => {
  audioInit();
  if (/^(Arrow|Space|Tab)/.test(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code); pressed.add(e.code); uiKeys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouse.l = mouse.r = false; });
function setMouse(e) {
  const r = wrap.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  mouse.x = fx * VW; mouse.y = fy * VH; mouse.ux = fx * UW; mouse.uy = fy * UH; mouse.used = true;
}
wrap.addEventListener('mousemove', setMouse);
wrap.addEventListener('mousedown', e => {
  audioInit(); setMouse(e); e.preventDefault();
  if (e.button === 0) { mouse.l = mouse.lp = mouse.click = true; } else if (e.button === 2) { mouse.r = mouse.rp = true; }
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; else if (e.button === 2) mouse.r = false; });
wrap.addEventListener('contextmenu', e => e.preventDefault());

function toggleFullscreen() {
  try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {}
}
