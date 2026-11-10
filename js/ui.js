'use strict';
/* Interface: splash, menus, settings, HUD, level-up cards, end screens, main loop */
const hud = hudCv.getContext('2d');
const F_TITLE = '"Cinzel","Trajan Pro","Palatino Linotype","Book Antiqua",Georgia,serif', F_UI = 'Georgia,"Palatino Linotype","Times New Roman",serif';
const UI = { state: 'boot', t: 0, overlay: null, sel: 0, drag: null, cards: null, cardTitle: '', hpLag: 100, stung: false, miniT: 0 };
let wid = 0;
const miniCv = mk(MW, MH), mini = miniCv.getContext('2d');
wrap.addEventListener('mousemove', () => { mouse.moved = true; });
function resize() { const r = wrap.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); hudCv.width = Math.max(480, Math.round(r.width * d)); hudCv.height = Math.max(270, Math.round(r.height * d)); }
addEventListener('resize', resize); resize();
const applySettings = () => { wrap.classList.toggle('crt', !!SET.crt); audioVolumes(); };
function setState(s) { UI.state = s; UI.t = 0; UI.sel = 0; UI.overlay = null; UI.drag = null; }
function toMenu() { startMenuScene(); musicSet('menu'); MUS.intenT = 0; setState('menu'); }
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const inRect = (x, y, w, h) => mouse.used && mouse.ux >= x && mouse.ux <= x + w && mouse.uy >= y && mouse.uy <= y + h;

/* ---------- drawing helpers ---------- */
function txt(s, x, y, size, col = '#fff', o = {}) {
  hud.font = `${o.weight || 'bold'} ${size}px ${o.font || F_UI}`; hud.textAlign = o.align || 'center'; hud.textBaseline = 'alphabetic';
  if (o.glow) { hud.shadowColor = o.glow; hud.shadowBlur = o.blur || 24; }
  if (o.stroke !== false) { hud.lineJoin = 'round'; hud.lineWidth = Math.max(3, size / 7); hud.strokeStyle = 'rgba(8,6,14,0.9)'; hud.strokeText(s, x, y); }
  hud.fillStyle = col; hud.fillText(s, x, y); hud.shadowBlur = 0;
}
function panel(x, y, w, h, a = 0.9) {
  const g = hud.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(30,25,46,${a})`); g.addColorStop(1, `rgba(10,8,18,${a})`);
  hud.fillStyle = g; hud.fillRect(x, y, w, h);
  hud.strokeStyle = '#6a5630'; hud.lineWidth = 3; hud.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  hud.strokeStyle = 'rgba(217,176,74,0.35)'; hud.lineWidth = 1; hud.strokeRect(x + 7.5, y + 7.5, w - 15, h - 15);
  hud.fillStyle = '#d9b04a';
  for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { hud.save(); hud.translate(cx, cy); hud.rotate(Math.PI / 4); hud.fillRect(-6, -6, 12, 12); hud.restore(); }
}
function ember(x, y, r, a) {
  hud.globalCompositeOperation = 'lighter';
  const g = hud.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, `rgba(255,250,220,${a})`); g.addColorStop(0.12, `rgba(255,200,90,${a * 0.9})`); g.addColorStop(0.35, `rgba(255,110,30,${a * 0.35})`); g.addColorStop(1, 'rgba(255,60,10,0)');
  hud.fillStyle = g; hud.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); hud.globalCompositeOperation = 'source-over';
}
function uiEmbers(n, x0, x1, t, a) {
  hud.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const h1 = hsh(i, 7), h2 = hsh(i, 13), y = UH + 40 - ((t * (30 + h1 * 60) + h2 * 1400) % (UH + 80)), x = lerp(x0, x1, h2) + Math.sin(t * (0.5 + h1) + i) * 30;
    hud.fillStyle = `rgba(255,${150 + Math.floor(h1 * 80)},60,${a * (0.25 + 0.5 * Math.abs(Math.sin(t * 2 + i)))})`; hud.beginPath(); hud.arc(x, y, 2 + h1 * 3, 0, TAU); hud.fill();
  }
  hud.globalCompositeOperation = 'source-over';
}
function logo(x, y, size, a, align) {
  hud.globalAlpha = a; hud.font = `bold ${size}px ${F_TITLE}`; hud.textAlign = align; hud.lineJoin = 'round';
  const g = hud.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.1); g.addColorStop(0, '#fff6d0'); g.addColorStop(0.55, '#ffc04a'); g.addColorStop(1, '#c2501a');
  hud.shadowColor = '#ff7a20'; hud.shadowBlur = 60; hud.lineWidth = size / 8; hud.strokeStyle = '#1a0c08'; hud.strokeText('ИСКРА БЕЗДНЫ', x, y);
  hud.shadowBlur = 24; hud.fillStyle = g; hud.fillText('ИСКРА БЕЗДНЫ', x, y); hud.shadowBlur = 0; hud.globalAlpha = 1;
}
function ornament(x, y, w, a = 1) {
  hud.globalAlpha = a; const g = hud.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(217,176,74,0)'); g.addColorStop(0.5, 'rgba(217,176,74,1)'); g.addColorStop(1, 'rgba(217,176,74,0)');
  hud.fillStyle = g; hud.fillRect(x, y, w, 2); hud.fillStyle = '#ffd98a'; hud.save(); hud.translate(x + w / 2, y + 1); hud.rotate(Math.PI / 4); hud.fillRect(-6, -6, 12, 12); hud.restore(); hud.globalAlpha = 1;
}
function icon(kind, x, y, s, col) {
  hud.save(); hud.translate(x, y); hud.scale(s / 24, s / 24); hud.translate(-12, -12);
  hud.strokeStyle = hud.fillStyle = col; hud.lineWidth = 2.4; hud.lineCap = hud.lineJoin = 'round';
  const L = (...p) => { hud.beginPath(); hud.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) hud.lineTo(p[i], p[i + 1]); hud.stroke(); };
  const C = (cx, cy, r, fill) => { hud.beginPath(); hud.arc(cx, cy, r, 0, TAU); fill ? hud.fill() : hud.stroke(); };
  const rays = () => { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; L(12 + Math.cos(a) * 7, 12 + Math.sin(a) * 7, 12 + Math.cos(a) * 10.5, 12 + Math.sin(a) * 10.5); } };
  switch (kind) {
    case 'sword': hud.lineWidth = 3; L(8, 16, 20, 4); hud.lineWidth = 2.4; L(5, 12, 12, 19); L(4, 20, 8, 16); break;
    case 'flame': hud.beginPath(); hud.moveTo(12, 2); hud.bezierCurveTo(18, 9, 20, 14, 12, 22); hud.bezierCurveTo(4, 14, 6, 9, 12, 2); hud.fill(); break;
    case 'dash': L(4, 5, 11, 12, 4, 19); L(12, 5, 19, 12, 12, 19); break;
    case 'nova': C(12, 12, 4, true); rays(); break;
    case 'potion': hud.fillRect(10, 2, 4, 7); C(12, 15, 6.5, true); L(8, 3, 16, 3); break;
    case 'heart': hud.beginPath(); hud.moveTo(12, 21); hud.bezierCurveTo(0, 12, 5, 2, 12, 8); hud.bezierCurveTo(19, 2, 24, 12, 12, 21); hud.fill(); break;
    case 'mana': hud.beginPath(); hud.moveTo(12, 2); hud.bezierCurveTo(19, 11, 19, 22, 12, 22); hud.bezierCurveTo(5, 22, 5, 11, 12, 2); hud.fill(); break;
    case 'speed': L(3, 7, 15, 7); L(7, 12, 21, 12); L(3, 17, 15, 17); break;
    case 'skull': C(12, 10, 7, true); hud.fillRect(8, 15, 8, 5); hud.fillStyle = '#141020'; C(9, 10, 2, true); C(15, 10, 2, true); break;
    case 'crit': C(12, 12, 8); C(12, 12, 2.5, true); L(12, 1, 12, 6); L(12, 18, 12, 23); L(1, 12, 6, 12); L(18, 12, 23, 12); break;
    case 'arc': hud.lineWidth = 3.4; hud.beginPath(); hud.arc(6, 18, 13, -1.5, 0.1); hud.stroke(); break;
    case 'multi': C(5, 17, 3, true); C(12, 7, 3, true); C(19, 17, 3, true); break;
    case 'clock': C(12, 12, 9); L(12, 12, 12, 6); L(12, 12, 16, 14); break;
    case 'coin': C(12, 12, 9, true); hud.fillStyle = '#8a5a10'; hud.fillRect(10.5, 7, 3, 10); break;
  }
  hud.restore();
}
const PERK_ICON = { hp: 'heart', atk: 'sword', spell: 'flame', mana: 'mana', speed: 'speed', leech: 'skull', crit: 'crit', arc: 'arc', multi: 'multi', cd: 'clock', pot: 'potion', light: 'nova' };
function bar(x, y, w, h, frac, c1, c2, label, lag) {
  frac = clamp(frac, 0, 1);
  hud.fillStyle = 'rgba(8,6,14,0.9)'; hud.fillRect(x - 3, y - 3, w + 6, h + 6); hud.fillStyle = '#1c1826'; hud.fillRect(x, y, w, h);
  if (lag > frac) { hud.fillStyle = '#ffe0c0'; hud.fillRect(x, y, w * clamp(lag, 0, 1), h); }
  const g = hud.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2);
  hud.fillStyle = g; hud.fillRect(x, y, w * frac, h);
  hud.fillStyle = 'rgba(255,255,255,0.22)'; hud.fillRect(x, y + 2, w * frac, h * 0.26);
  hud.strokeStyle = '#6a5630'; hud.lineWidth = 2; hud.strokeRect(x - 2, y - 2, w + 4, h + 4);
  if (label) txt(label, x + w / 2, y + h * 0.78, h * 0.74, '#fff');
}

/* ---------- widgets (immediate mode; keyboard focus = UI.sel) ---------- */
function button(label, x, y, w, h, o = {}) {
  const i = wid++, hover = inRect(x, y, w, h);
  if (hover && mouse.moved && UI.sel !== i) { UI.sel = i; sfx('uiMove'); }
  const f = UI.sel === i, g = hud.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, f ? 'rgba(217,150,60,0.5)' : 'rgba(40,34,60,0.7)'); g.addColorStop(1, f ? 'rgba(217,150,60,0.05)' : 'rgba(40,34,60,0.15)');
  hud.fillStyle = g; hud.fillRect(x, y, w, h);
  hud.fillStyle = f ? '#ffd98a' : '#6a5630'; hud.fillRect(x, y, f ? 6 : 3, h);
  txt(label, o.center ? x + w / 2 : x + 34 + (f ? 8 : 0), y + h * 0.66, h * 0.5, f ? '#fff4d0' : '#cfc4b0', { align: o.center ? 'center' : 'left', font: F_TITLE, glow: f ? '#ff9a30' : null });
  const act = (hover && mouse.click) || (f && (uiKeys.has('Enter') || uiKeys.has('Space')));
  if (act) sfx('uiOk');
  return act;
}
function rowBase(label, x, y, w) {
  const i = wid++, hover = inRect(x - 16, y - 6, w + 32, 58);
  if (hover && mouse.moved && UI.sel !== i) { UI.sel = i; sfx('uiMove'); }
  const f = UI.sel === i;
  if (f) { hud.fillStyle = 'rgba(217,176,74,0.13)'; hud.fillRect(x - 16, y - 6, w + 32, 58); hud.fillStyle = '#ffd98a'; hud.fillRect(x - 16, y - 6, 4, 58); }
  txt(label, x, y + 34, 31, f ? '#ffe9b0' : '#d8ccb8', { align: 'left', stroke: false });
  return { i, f, hover };
}
function slider(label, x, y, w, v) {
  const { i, f, hover } = rowBase(label, x, y, w), tx = x + w * 0.5, tw = w * 0.5 - 90;
  if (hover && mouse.click) UI.drag = i;
  if (!mouse.l) UI.drag = UI.drag === i ? null : UI.drag;
  if (UI.drag === i) v = clamp((mouse.ux - tx) / tw, 0, 1);
  if (f && (uiKeys.has('ArrowLeft') || uiKeys.has('KeyA'))) v = clamp(v - 0.05, 0, 1);
  if (f && (uiKeys.has('ArrowRight') || uiKeys.has('KeyD'))) v = clamp(v + 0.05, 0, 1);
  hud.fillStyle = '#14101c'; hud.fillRect(tx, y + 18, tw, 10); hud.fillStyle = '#d9b04a'; hud.fillRect(tx, y + 18, tw * v, 10);
  hud.fillStyle = f ? '#fff4d0' : '#e8d8b0'; hud.fillRect(tx + tw * v - 6, y + 8, 12, 30);
  txt(Math.round(v * 100) + '%', x + w, y + 34, 28, '#e8d8b0', { align: 'right', stroke: false });
  return Math.round(v * 100) / 100;
}
function choice(label, x, y, w, value) {
  const { f, hover } = rowBase(label, x, y, w);
  txt('‹  ' + value + '  ›', x + w, y + 34, 30, f ? '#ffd98a' : '#e8d8b0', { align: 'right', stroke: false });
  const act = (hover && mouse.click) || (f && ['Enter', 'Space', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].some(k => uiKeys.has(k)));
  if (act) sfx('uiOk');
  return act;
}

/* ---------- overlays ---------- */
function drawOverlay() {
  hud.fillStyle = 'rgba(4,3,10,0.62)'; hud.fillRect(0, 0, UW, UH);
  const back = () => { UI.overlay = null; UI.sel = 0; sfx('uiBack'); };
  if (UI.overlay === 'settings') {
    const x = 500, y = 90, w = 920, h = 900, rx = x + 70, rw = w - 140, on = v => v ? 'Вкл' : 'Выкл';
    panel(x, y, w, h); txt('Настройки', UW / 2, y + 84, 58, '#ffd98a', { font: F_TITLE, glow: '#ff9a30' }); ornament(x + 160, y + 108, w - 320);
    let ry = y + 146; const before = JSON.stringify(SET);
    SET.master = slider('Общая громкость', rx, ry, rw, SET.master); ry += 68;
    SET.music = slider('Музыка', rx, ry, rw, SET.music); ry += 68;
    SET.sfx = slider('Звуковые эффекты', rx, ry, rw, SET.sfx); ry += 68;
    if (choice('Качество теней', rx, ry, rw, ['Низкое', 'Среднее', 'Высокое'][SET.quality])) SET.quality = (SET.quality + 1) % 3; ry += 68;
    if (choice('Свечение (bloom)', rx, ry, rw, on(SET.bloom))) SET.bloom = !SET.bloom; ry += 68;
    if (choice('Пиксельная палитра', rx, ry, rw, on(SET.dither))) SET.dither = !SET.dither; ry += 68;
    if (choice('ЭЛТ-фильтр', rx, ry, rw, on(SET.crt))) SET.crt = !SET.crt; ry += 68;
    if (choice('Тряска экрана', rx, ry, rw, on(SET.shake))) SET.shake = !SET.shake; ry += 68;
    if (choice('Числа урона', rx, ry, rw, on(SET.dmgNums))) SET.dmgNums = !SET.dmgNums; ry += 68;
    if (choice('Полный экран', rx, ry, rw, document.fullscreenElement ? 'Вкл' : 'Выкл')) toggleFullscreen();
    if (JSON.stringify(SET) !== before) { saveSettings(); applySettings(); }
    if (button('Назад', UW / 2 - 170, y + h - 96, 340, 62, { center: true }) || uiKeys.has('Escape')) back();
  } else {
    const x = 330, y = 110, w = 1260, h = 860; panel(x, y, w, h);
    txt('Управление', UW / 2, y + 84, 58, '#ffd98a', { font: F_TITLE, glow: '#ff9a30' }); ornament(x + 300, y + 108, w - 600);
    const rows = [['W A S D / стрелки', 'движение'], ['Мышь', 'прицел'], ['ЛКМ / J', 'удар мечом · третий в серии — мощный · отражает снаряды'], ['ПКМ / K', 'Искра — огненный заряд (10 маны)'],
      ['Пробел / Shift', 'рывок: неуязвимость, перелёт через пропасти'], ['Q', 'Нова — огненный взрыв вокруг (30 маны)'], ['R', 'выпить зелье'], ['E', 'зажечь жаровню, открыть сундук, алтарь'], ['Esc / P', 'пауза'], ['F', 'полный экран']];
    rows.forEach(([k, v], i) => { txt(k, x + 380, y + 176 + i * 52, 30, '#ffd98a', { align: 'right' }); txt(v, x + 420, y + 176 + i * 52, 28, '#e0d6c4', { align: 'left', weight: 'normal' }); });
    txt('Зажгите все жаровни — печать на спуске падёт. Алтарь Искры меняет золото на усиления.', UW / 2, y + 716, 26, '#b8a888', { weight: 'italic' });
    txt('На шестой глубине ждёт Страж Пепла.', UW / 2, y + 752, 26, '#b8a888', { weight: 'italic' });
    if (button('Назад', UW / 2 - 170, y + h - 96, 340, 62, { center: true }) || uiKeys.has('Escape')) back();
  }
}

/* ---------- screens ---------- */
function drawBoot() {
  hud.fillStyle = '#020205'; hud.fillRect(0, 0, UW, UH);
  ember(UW / 2, UH / 2 - 60, 16 + Math.sin(UI.t * 3) * 2, 0.9);
  txt('Нажмите любую клавишу', UW / 2, UH / 2 + 110, 42, `rgba(255,224,170,${0.6 + 0.4 * Math.sin(UI.t * 3)})`, { font: F_TITLE });
  txt('со звуком погружение глубже', UW / 2, UH / 2 + 160, 24, '#7a7084', { weight: 'italic' });
  if (uiKeys.size || mouse.click) setState('splash');
}
function drawSplash() {
  const t = UI.t;
  if (!UI.stung && t > 0.15) { UI.stung = true; sfx('sting'); }
  if (t > 3.4) musicSet('menu');
  const reveal = clamp((t - 6.2) / 1.3, 0, 1);   // the black lifts to reveal the living menu scene
  hud.fillStyle = `rgba(2,2,5,${1 - reveal * 0.75})`; hud.fillRect(0, 0, UW, UH);
  if (t < 3.6) {
    const a = clamp(t / 0.8, 0, 1) * clamp((3.6 - t) / 0.6, 0, 1), q = clamp((t - 1) / 0.8, 0, 1) * clamp((3.6 - t) / 0.6, 0, 1);
    ember(UW / 2, 420, (8 + t * 5) * (1 + Math.sin(t * 9) * 0.06), a);
    txt('Когда погас последний огонь,', UW / 2, 650, 42, `rgba(232,220,200,${q})`, { font: F_TITLE, weight: 'italic', stroke: false });
    txt('во тьму спустился тот, кто нёс Искру.', UW / 2, 712, 42, `rgba(232,220,200,${q})`, { font: F_TITLE, weight: 'italic', stroke: false });
  } else {
    const a = clamp((t - 3.6) / 1.2, 0, 1) * (1 - reveal), fl = Math.exp(-Math.pow((t - 4.5) * 2.2, 2));
    uiEmbers(44, 260, 1660, t, a);
    logo(UW / 2, 540, 156, a, 'center');
    if (fl > 0.02) { hud.globalCompositeOperation = 'lighter'; const g = hud.createRadialGradient(UW / 2, 490, 0, UW / 2, 490, 900); g.addColorStop(0, `rgba(255,220,150,${fl * 0.7})`); g.addColorStop(1, 'rgba(255,120,30,0)'); hud.fillStyle = g; hud.fillRect(0, 440, UW, 100); hud.globalCompositeOperation = 'source-over'; }
    ornament(UW / 2 - 380, 584, 760, a);
    txt('R P G   ·   D U N G E O N', UW / 2, 646, 34, `rgba(255,214,150,${a})`, { font: F_TITLE, stroke: false });
  }
  if (t > 7.5 || (t > 0.6 && (uiKeys.size || mouse.click))) { setState('menu'); musicSet('menu'); }
}
function drawMenu() {
  const g = hud.createLinearGradient(0, 0, 1350, 0); g.addColorStop(0, 'rgba(4,3,10,0.95)'); g.addColorStop(0.5, 'rgba(4,3,10,0.62)'); g.addColorStop(1, 'rgba(4,3,10,0)');
  hud.fillStyle = g; hud.fillRect(0, 0, UW, UH);
  const fade = clamp(UI.t / 0.8, 0, 1);
  uiEmbers(26, 60, 900, UI.t + 50, 0.8 * fade);
  logo(128, 250, 112, fade, 'left');
  txt('Хроники последнего огня', 136, 314, 34, `rgba(232,200,144,${fade})`, { align: 'left', font: F_TITLE, weight: 'italic' });
  ornament(120, 344, 620, fade);
  if (UI.overlay) return drawOverlay();
  const hasRun = !!store.get('run', null); let y = 410;
  if (hasRun) { if (button('Продолжить', 136, y, 480, 72)) { continueGame(); setState('play'); return; } y += 86; }
  if (button('Новая игра', 136, y, 480, 72)) { newGame(); setState('play'); return; } y += 86;
  if (button('Настройки', 136, y, 480, 72)) { UI.overlay = 'settings'; UI.sel = 0; } y += 86;
  if (button('Управление', 136, y, 480, 72)) { UI.overlay = 'help'; UI.sel = 0; } y += 86;
  if (button('Полный экран', 136, y, 480, 72)) toggleFullscreen();
  const best = store.get('best', null);
  if (best && best.depth) txt(`Рекорд: глубина ${best.depth} · повержено врагов: ${best.kills}`, 136, 1010, 26, '#b8a888', { align: 'left', weight: 'italic' });
  txt('v1.0 · графика, музыка и звук создаются кодом в реальном времени', UW - 40, 1044, 22, 'rgba(200,190,170,0.55)', { align: 'right', weight: 'normal' });
}

function drawMini() {
  mini.clearRect(0, 0, MW, MH);
  const col = ['#7a7494', '#262234', '#3a6ab0', '#0e0c14', '#d0601c'];
  for (let i = 0; i < MW * MH; i++) if (LV.seen[i]) { mini.fillStyle = col[LV.map[i]]; mini.fillRect(i % MW, Math.floor(i / MW), 1, 1); }
}
function drawHUD() {
  const t = G.time;
  // hero frame
  panel(24, 24, 572, 152, 0.82);
  hud.beginPath(); hud.arc(100, 100, 52, 0, TAU); hud.fillStyle = '#141020'; hud.fill(); hud.lineWidth = 5; hud.strokeStyle = '#6a5630'; hud.stroke();
  hud.beginPath(); hud.arc(100, 100, 52, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(pl.xp / xpNeed(pl.lvl), 0, 1)); hud.strokeStyle = '#ffd24a'; hud.stroke();
  txt(pl.lvl, 100, 118, 54, '#ffe9b0', { font: F_TITLE }); txt('уровень', 100, 142, 15, '#b8a888', { stroke: false });
  UI.hpLag = UI.hpLag < pl.hp ? pl.hp : UI.hpLag + (pl.hp - UI.hpLag) * 0.06;
  bar(176, 46, 396, 36, pl.hp / pl.maxHp, '#ff5a6a', '#a01428', Math.ceil(pl.hp) + ' / ' + pl.maxHp, UI.hpLag / pl.maxHp);
  bar(176, 98, 396, 28, pl.mp / pl.maxMp, '#6ab0ff', '#1c3ca0', Math.floor(pl.mp) + ' / ' + pl.maxMp);
  bar(176, 142, 396, 10, pl.xp / xpNeed(pl.lvl), '#ffe080', '#c88a20');
  icon('coin', 52, 212, 34, '#ffd24a'); txt(pl.gold, 80, 224, 34, '#ffd24a', { align: 'left' });
  // minimap
  const mx = UW - 24 - 296, my = 24;
  panel(mx, my, 296, 216, 0.78);
  UI.miniT -= 1; if (UI.miniT <= 0) { UI.miniT = 12; drawMini(); }
  hud.imageSmoothingEnabled = false; hud.globalAlpha = 0.92; hud.drawImage(miniCv, mx + 8, my + 8, 280, 200); hud.globalAlpha = 1;
  const mp = (x, y, c, s) => { hud.fillStyle = c; hud.fillRect(mx + 8 + x / TS * 5 - s / 2, my + 8 + y / TS * 5 - s / 2, s, s); };
  for (const b of LV.braziers) if (LV.seen[Math.floor(b.y / TS) * MW + Math.floor(b.x / TS)]) mp(b.x, b.y, b.lit ? '#ffb040' : '#8a5a30', 8);
  if (LV.seen[LV.stairs.ty * MW + LV.stairs.tx]) mp(LV.stairs.x, LV.stairs.y, LV.stairs.open ? '#c080ff' : '#ff4030', 9);
  if (Math.floor(t * 4) % 2) mp(pl.x, pl.y, '#ffffff', 8);
  txt('Глубина ' + G.depth + ' · ' + LV.B.name, UW - 28, 276, 26, '#e8d8b0', { align: 'right' });
  const lit = LV.braziers.filter(b => b.lit).length;
  const goal = LV.stairs.open ? 'Спуск открыт — ищите лестницу' : LV.boss ? 'Одолейте Стража Пепла' : `Жаровни: ${lit} / ${LV.braziers.length}`;
  txt(goal, UW - 28, 310, 24, LV.stairs.open ? '#c8a0ff' : '#ffb860', { align: 'right', weight: 'italic' });
  // skills
  const slots = [{ ic: 'sword', key: 'ЛКМ', cd: pl.atkCd / 0.44 }, { ic: 'flame', key: 'ПКМ', cd: pl.boltCd / 0.34, dim: pl.mp < 10 }, { ic: 'dash', key: 'Пробел', cd: pl.dashCd / (0.85 * pl.cdK) },
    { ic: 'nova', key: 'Q', cd: pl.novaCd / (7 * pl.cdK), dim: pl.mp < 30 }, { ic: 'potion', key: 'R', n: pl.potions, dim: pl.potions <= 0 }];
  slots.forEach((s, i) => {
    const x = 716 + i * 100, y = UH - 140, cd = clamp(s.cd || 0, 0, 1);
    hud.fillStyle = 'rgba(14,11,24,0.88)'; hud.fillRect(x, y, 88, 88); hud.strokeStyle = cd > 0 || s.dim ? '#4a4038' : '#d9b04a'; hud.lineWidth = 3; hud.strokeRect(x + 1.5, y + 1.5, 85, 85);
    icon(s.ic, x + 44, y + 44, 52, s.dim ? '#5a5870' : ['#e6edf5', '#ffa040', '#9ab0ff', '#ffd060', '#ff5a70'][i]);
    if (cd > 0) { hud.fillStyle = 'rgba(4,3,10,0.72)'; hud.fillRect(x + 3, y + 3 + 82 * (1 - cd), 82, 82 * cd); }
    if (s.n !== undefined) txt(s.n, x + 78, y + 80, 28, '#fff', { align: 'right' });
    txt(s.key, x + 44, y + 112, 20, '#b8a888', { weight: 'normal' });
  });
  // boss
  if (G.boss && G.bossAwake) { txt('Страж Пепла', UW / 2, 62, 34, '#ffb060', { font: F_TITLE, glow: '#ff5a10' }); bar(UW / 2 - 420, 78, 840, 22, G.boss.hp / G.boss.maxHp, '#ff9040', '#a02808'); }
  // world-anchored: enemy health and floating numbers
  for (const e of enemies) if (e.awake && e.hp < e.maxHp && e.type !== 'boss' && !e.phased) {
    const x = (e.x - cam.x) * 5 - 24, y = (e.y - cam.y - 24 - e.z) * 5;
    hud.fillStyle = 'rgba(8,6,14,0.85)'; hud.fillRect(x - 2, y - 2, 52, 10); hud.fillStyle = e.elite ? '#ffd24a' : '#e8404a'; hud.fillRect(x, y, 48 * clamp(e.hp / e.maxHp, 0, 1), 6);
  }
  if (SET.dmgNums) for (const f of texts) {
    hud.globalAlpha = clamp((0.9 - f.t) / 0.3, 0, 1);
    txt(f.txt, (f.x - cam.x) * 5, (f.y - cam.y) * 5 - f.t * 90, (f.big ? 48 : 32) * (f.t < 0.1 ? 1 + (0.1 - f.t) * 5 : 1), f.col); hud.globalAlpha = 1;
  }
  if (G.prompt) { hud.font = `bold 30px ${F_UI}`; const w = hud.measureText(G.prompt).width + 130; panel(UW / 2 - w / 2, UH - 236, w, 64, 0.86); txt('E', UW / 2 - w / 2 + 44, UH - 193, 32, '#ffd24a'); txt(G.prompt, UW / 2 + 22, UH - 194, 30, '#f0e6d0'); }
  if (G.toast) { hud.globalAlpha = clamp(G.toast.t, 0, 1); txt(G.toast.text, UW / 2, 200, 36, '#ffe9b0', { font: F_TITLE, glow: '#ff7a20' }); hud.globalAlpha = 1; }
  if (G.banner) {
    const b = G.banner, a = clamp(b.t / 0.6, 0, 1) * clamp((4.2 - b.t) / 0.8, 0, 1);
    hud.globalAlpha = a; txt(b.title, UW / 2, 360, 104, '#ffe2a0', { font: F_TITLE, glow: '#ff7a20', blur: 40 }); txt(b.sub, UW / 2, 424, 34, '#e8d8c0', { weight: 'italic' }); hud.globalAlpha = 1; ornament(UW / 2 - 360, 384, 720, a);
  }
}

function drawCards() {
  hud.fillStyle = 'rgba(4,3,10,0.72)'; hud.fillRect(0, 0, UW, UH);
  txt(UI.cardTitle, UW / 2, 190, 84, '#ffe2a0', { font: F_TITLE, glow: '#ff7a20', blur: 40 }); ornament(UW / 2 - 360, 214, 720);
  txt('Выберите усиление', UW / 2, 262, 30, '#d8ccb8', { weight: 'italic' });
  const n = UI.cards.length, cw = 400, gap = 40, x0 = UW / 2 - (n * cw + (n - 1) * gap) / 2;
  if (uiKeys.has('ArrowLeft') || uiKeys.has('KeyA')) { UI.sel = (UI.sel + n - 1) % n; sfx('uiMove'); }
  if (uiKeys.has('ArrowRight') || uiKeys.has('KeyD')) { UI.sel = (UI.sel + 1) % n; sfx('uiMove'); }
  let chosen = null;
  UI.cards.forEach((c, i) => {
    const x = x0 + i * (cw + gap), hover = inRect(x, 320, cw, 520);
    if (hover && mouse.moved && UI.sel !== i) { UI.sel = i; sfx('uiMove'); }
    const f = UI.sel === i, y = 320 - (f ? 16 : 0);
    panel(x, y, cw, 520, 0.95);
    if (f) { hud.strokeStyle = '#ffd98a'; hud.lineWidth = 4; hud.shadowColor = '#ff9a30'; hud.shadowBlur = 30; hud.strokeRect(x + 2, y + 2, cw - 4, 516); hud.shadowBlur = 0; }
    hud.beginPath(); hud.arc(x + cw / 2, y + 140, 74, 0, TAU); hud.fillStyle = '#141020'; hud.fill(); hud.lineWidth = 4; hud.strokeStyle = '#d9b04a'; hud.stroke();
    icon(PERK_ICON[c.id], x + cw / 2, y + 140, 84, f ? '#ffd060' : '#c8a060');
    txt(c.name, x + cw / 2, y + 286, 40, '#ffe9b0', { font: F_TITLE });
    const words = c.desc.split(' '); let line = '', ly = y + 344; hud.font = `normal 28px ${F_UI}`;
    for (const w of words) { if (hud.measureText(line + w).width > cw - 70) { txt(line.trim(), x + cw / 2, ly, 28, '#d8ccb8', { weight: 'normal', stroke: false }); line = ''; ly += 38; } line += w + ' '; }
    txt(line.trim(), x + cw / 2, ly, 28, '#d8ccb8', { weight: 'normal', stroke: false });
    const own = pl.perks[c.id] || 0; if (own) txt('уже взято: ' + own, x + cw / 2, y + 468, 22, '#8ac8ff', { weight: 'italic', stroke: false });
    txt(String(i + 1), x + 34, y + 46, 28, '#6a5630', { stroke: false });
    if ((hover && mouse.click) || uiKeys.has('Digit' + (i + 1)) || (f && (uiKeys.has('Enter') || uiKeys.has('Space')))) chosen = c;
  });
  if (chosen) { takePerk(chosen); if (G.pending > 0 && (UI.cards = pickPerks(3)).length) { UI.sel = 0; UI.cardTitle = 'Ещё одно усиление'; } else { G.pending = 0; setState('play'); } }
}
function statRows(rows, x, y, w) { rows.forEach(([k, v], i) => { txt(k, x, y + i * 44, 28, '#b8a888', { align: 'left', weight: 'normal', stroke: false }); txt(v, x + w, y + i * 44, 28, '#ffe9b0', { align: 'right', stroke: false }); }); }
function drawPause() {
  hud.fillStyle = 'rgba(4,3,10,0.68)'; hud.fillRect(0, 0, UW, UH);
  if (UI.overlay) return drawOverlay();
  panel(330, 190, 600, 700); txt('Пауза', 630, 280, 64, '#ffd98a', { font: F_TITLE, glow: '#ff9a30' }); ornament(410, 306, 440);
  if (button('Продолжить', 400, 360, 460, 72) || uiKeys.has('Escape') || uiKeys.has('KeyP')) { setState('play'); return; }
  if (button('Настройки', 400, 448, 460, 72)) { UI.overlay = 'settings'; UI.sel = 0; }
  if (button('Управление', 400, 536, 460, 72)) { UI.overlay = 'help'; UI.sel = 0; }
  if (button('Выйти в меню', 400, 624, 460, 72)) { toMenu(); return; }
  txt('Прогресс сохраняется в начале каждой глубины', 630, 840, 22, '#8a8094', { weight: 'italic', stroke: false });
  panel(990, 190, 600, 700); txt('Искроносец', 1290, 270, 48, '#ffd98a', { font: F_TITLE }); ornament(1070, 292, 440);
  statRows([['Уровень', pl.lvl], ['Здоровье', Math.ceil(pl.hp) + ' / ' + pl.maxHp], ['Мана', Math.floor(pl.mp) + ' / ' + pl.maxMp], ['Урон меча', Math.round(pl.atk)], ['Урон Искры', Math.round(pl.spell)], ['Шанс крита', Math.round(pl.crit * 100) + '%'], ['Золото', pl.gold], ['Повержено врагов', pl.kills]], 1050, 356, 480);
  const own = PERKS.filter(p => pl.perks[p.id]);
  txt(own.length ? 'Усиления' : 'Усилений пока нет', 1290, 726, 26, '#b8a888', { weight: 'italic', stroke: false });
  own.slice(0, 12).forEach((p, i) => { const x = 1062 + (i % 6) * 80, y = 770 + Math.floor(i / 6) * 62; icon(PERK_ICON[p.id], x, y, 40, '#ffd060'); if (pl.perks[p.id] > 1) txt('×' + pl.perks[p.id], x + 34, y + 14, 20, '#fff', { stroke: false }); });
}
function drawEnd(win) {
  const a = clamp(UI.t / 1.2, 0, 1);
  hud.fillStyle = win ? `rgba(20,12,2,${0.7 * a})` : `rgba(24,2,6,${0.72 * a})`; hud.fillRect(0, 0, UW, UH);
  if (win) uiEmbers(50, 200, 1720, UI.t, a);
  hud.globalAlpha = a;
  txt(win ? 'СТРАЖ ПАЛ' : 'ИСКРА УГАСЛА', UW / 2, 290, 120, win ? '#ffe2a0' : '#ff6a5a', { font: F_TITLE, glow: win ? '#ff9a30' : '#ff2010', blur: 50 });
  ornament(UW / 2 - 420, 322, 840, a);
  txt(win ? 'Пламя вновь горит в сердце Бездны. Но тьма уходит глубже…' : 'Тьма сомкнулась — но Искру можно пронести вновь.', UW / 2, 384, 32, '#e8d8c0', { weight: 'italic' });
  panel(UW / 2 - 320, 430, 640, 290, 0.8);
  statRows([['Глубина', G.depth], ['Уровень героя', pl.lvl], ['Повержено врагов', pl.kills], ['Золото', pl.gold], ['Время', fmtTime(G.runTime)]], UW / 2 - 260, 492, 520);
  hud.globalAlpha = 1;
  if (UI.t < 1) return;
  if (button(win ? 'Спускаться дальше' : 'Начать заново', UW / 2 - 240, 760, 480, 72, { center: true })) { if (win) { G.victory = false; descend(); } else newGame(); setState('play'); return; }
  if (button('В главное меню', UW / 2 - 240, 848, 480, 72, { center: true })) toMenu();
}
function drawCursor() {
  if (!mouse.used || DEMO) return;
  const x = mouse.ux, y = mouse.uy;
  if (UI.state === 'play') {
    hud.fillStyle = 'rgba(8,6,14,0.9)'; for (const [dx, dy, w, h] of [[-22, -4, 14, 8], [8, -4, 14, 8], [-4, -22, 8, 14], [-4, 8, 8, 14]]) hud.fillRect(x + dx, y + dy, w, h);
    hud.fillStyle = '#ffe2a0'; for (const [dx, dy, w, h] of [[-20, -2, 10, 4], [10, -2, 10, 4], [-2, -20, 4, 10], [-2, 10, 4, 10]]) hud.fillRect(x + dx, y + dy, w, h);
  } else {
    hud.beginPath(); hud.moveTo(x, y); hud.lineTo(x + 26, y + 12); hud.lineTo(x + 12, y + 16); hud.lineTo(x + 8, y + 30); hud.closePath();
    hud.fillStyle = '#ffe2a0'; hud.fill(); hud.lineWidth = 3; hud.strokeStyle = '#1a0c08'; hud.stroke();
  }
}
function drawUI() {
  hud.setTransform(hudCv.width / UW, 0, 0, hudCv.height / UH, 0, 0); hud.clearRect(0, 0, UW, UH); wid = 0;
  if (glErr) { hud.fillStyle = '#020205'; hud.fillRect(0, 0, UW, UH); txt('Не удалось запустить WebGL', UW / 2, 500, 48, '#ff6a5a'); txt(String(glErr).slice(0, 110), UW / 2, 560, 24, '#b8a888', { weight: 'normal' }); return; }
  if (uiKeys.has('KeyF') && UI.state !== 'boot') toggleFullscreen();
  switch (UI.state) {
    case 'boot': drawBoot(); break;
    case 'splash': drawSplash(); break;
    case 'menu': drawMenu(); break;
    case 'play':
      drawHUD();
      if (pl.dead) { if (pl.deadT > 1.5) setState('dead'); }
      else if (G.victory) setState('victory');
      else if (G.pending > 0) {
        if (DEMO && !params.get('ui')) { const c = pickPerks(1)[0]; if (c) takePerk(c); else G.pending = 0; }
        else if ((UI.cards = pickPerks(3)).length) { UI.cardTitle = G.levelFx ? 'Новый уровень' : 'Дар алтаря'; G.levelFx = false; setState('levelup'); sfx('levelup'); } else G.pending = 0;
      } else if (uiKeys.has('Escape') || uiKeys.has('KeyP')) { setState('pause'); sfx('uiBack'); }
      break;
    case 'levelup': drawHUD(); drawCards(); break;
    case 'pause': drawHUD(); drawPause(); break;
    case 'dead': drawEnd(false); break;
    case 'victory': drawEnd(true); break;
  }
  drawCursor();
  if (wid > 0 && UI.state !== 'levelup') {
    if (uiKeys.has('ArrowDown') || uiKeys.has('KeyS')) { UI.sel = (UI.sel + 1) % wid; sfx('uiMove'); }
    if (uiKeys.has('ArrowUp') || uiKeys.has('KeyW')) { UI.sel = (UI.sel + wid - 1) % wid; sfx('uiMove'); }
    UI.sel = Math.min(UI.sel, wid - 1);
  }
}

/* ---------- main loop ---------- */
const STEP = 1 / 60; let lastT = 0, acc = 0, frames = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000 || 0); lastT = now; acc += dt; UI.t += dt;
  const sim = UI.state === 'play' || UI.state === 'menu' || UI.state === 'splash' || UI.state === 'dead';
  while (acc >= STEP) { if (sim) tick(STEP); pressed.clear(); mouse.lp = mouse.rp = false; acc -= STEP; }
  if (UI.state !== 'boot') renderScene();
  drawUI(); musicTick();
  uiKeys.clear(); mouse.click = false; mouse.moved = false; frames++;
  if (DEMO) document.title = JSON.stringify({ ui: UI.state, frames, t: +G.time.toFixed(1), depth: G.depth, lvl: pl.lvl, hp: Math.round(pl.hp), gold: pl.gold, kills: pl.kills, braziers: LV.braziers.filter(b => b.lit).length + '/' + LV.braziers.length, enemies: enemies.length, err: window.__err || glErr || (gl ? gl.getError() : 'nogl') });
  requestAnimationFrame(frame);
}
window.onerror = (m, s, l) => { window.__err = m + ' @' + String(s).split('/').pop() + ':' + l; if (DEMO) document.title = 'ERR: ' + window.__err; };
applySettings();
startMenuScene();
if (DEMO) {   // ?demo autoplay; &depth=N start deeper; &ff=N fast-forward N seconds; &ui=state force a screen (smoke tests)
  newGame();
  const d = +params.get('depth') || 1;
  if (d > 1) { pl.lvl = d * 2; pl.maxHp += d * 25; pl.hp = pl.maxHp; pl.atk *= 1 + d * 0.3; pl.spell *= 1 + d * 0.3; pl.gold = 200; startLevel(d); }
  setState('play');
  for (let n = (+params.get('ff') || 0) * 60; n > 0; n--) { tick(STEP); if (G.pending > 0) { const c = pickPerks(1)[0]; if (c) takePerk(c); else G.pending = 0; } if (G.victory) { G.victory = false; descend(); } if (pl.dead && pl.deadT > 2) newGame(); }
  const u = params.get('ui');
  if (u === 'menu') toMenu(); else if (u === 'splash') { startMenuScene(); setState('splash'); UI.t = +params.get('t') || 0; UI.stung = true; }
  else if (u === 'levelup') { UI.cards = pickPerks(3); UI.cardTitle = 'Новый уровень'; setState('levelup'); }
  else if (u === 'settings' || u === 'help') { toMenu(); UI.overlay = u; } else if (u) setState(u);
}
requestAnimationFrame(frame);
