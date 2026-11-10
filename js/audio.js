'use strict';
/* Synthesised audio: sfx with reverb + stereo placement, and a generative adaptive soundtrack */
const AU = { ctx: null, last: {} };

function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = AU.ctx = new C(), sr = c.sampleRate;
    AU.master = c.createGain(); AU.comp = c.createDynamicsCompressor();
    AU.comp.threshold.value = -14; AU.comp.ratio.value = 5; AU.comp.attack.value = 0.004; AU.comp.release.value = 0.2;
    AU.master.connect(AU.comp); AU.comp.connect(c.destination);
    AU.sfx = c.createGain(); AU.mus = c.createGain(); AU.sfx.connect(AU.master); AU.mus.connect(AU.master);
    // dungeon reverb: decaying low-passed noise as the impulse response
    const len = sr * 2.6 | 0, ir = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) { const t = i / len; lp += ((Math.random() * 2 - 1) - lp) * (0.6 - 0.45 * t); d[i] = lp * Math.pow(1 - t, 2.4) * Math.min(1, i / 300); }
    }
    AU.rev = c.createConvolver(); AU.rev.buffer = ir;
    const rg = c.createGain(); rg.gain.value = 0.6; AU.rev.connect(rg); rg.connect(AU.master);
    AU.sfxSend = c.createGain(); AU.sfxSend.gain.value = 0.3; AU.sfx.connect(AU.sfxSend); AU.sfxSend.connect(AU.rev);
    AU.musSend = c.createGain(); AU.musSend.gain.value = 0.55; AU.mus.connect(AU.musSend); AU.musSend.connect(AU.rev);
    // echo bus for plucked notes
    AU.delay = c.createDelay(1); AU.delay.delayTime.value = 0.3;
    const fb = c.createGain(); fb.gain.value = 0.4; AU.delay.connect(fb); fb.connect(AU.delay); AU.delay.connect(AU.mus);
    AU.noise = c.createBuffer(1, sr * 2, sr);
    const nd = AU.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // constant ambience: wind through the halls + a sub drone
    const wind = c.createBufferSource(); wind.buffer = AU.noise; wind.loop = true;
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 280; wf.Q.value = 0.7;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 140; lfo.connect(lg); lg.connect(wf.frequency); lfo.start();
    AU.amb = c.createGain(); AU.amb.gain.value = 0; wind.connect(wf); wf.connect(AU.amb); AU.amb.connect(AU.mus); wind.start();
    const dr = c.createOscillator(), dg = c.createGain(); dr.type = 'sine'; dr.frequency.value = 55; dg.gain.value = 0.5; dr.connect(dg); dg.connect(AU.amb); dr.start();
    audioVolumes();
  } catch (e) { AU.ctx = null; }
}
function audioVolumes() {
  if (!AU.ctx) return;
  AU.master.gain.value = SET.master; AU.sfx.gain.value = SET.sfx; AU.mus.gain.value = SET.music * 0.85;
}
const audioOn = () => AU.ctx && AU.ctx.state === 'running';

function auOut(node, o) {
  const c = AU.ctx, dst = o.bus || AU.sfx;
  if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); node.connect(p); p.connect(dst); } else node.connect(dst);
}
function auEnv(g, t, dur, vol, attack) {
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
}
// o: type, to (pitch slide target), vol, attack, delay | at (absolute time), pan, bus
function tone(f, dur, o = {}) {
  const c = AU.ctx, t = o.at || c.currentTime + (o.delay || 0), os = c.createOscillator(), g = c.createGain();
  os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t);
  if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
  if (o.detune) os.detune.value = o.detune;
  auEnv(g, t, dur, o.vol || 0.1, o.attack || 0.004);
  os.connect(g); auOut(g, o); os.start(t); os.stop(t + dur + 0.05);
}
// o: type (filter), f, to, q, vol, attack, delay | at, pan, bus
function noise(dur, o = {}) {
  const c = AU.ctx, t = o.at || c.currentTime + (o.delay || 0), src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  src.buffer = AU.noise; src.loop = true;
  fl.type = o.type || 'bandpass'; fl.frequency.setValueAtTime(o.f || 1000, t); fl.Q.value = o.q || 1;
  if (o.to) fl.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + dur);
  auEnv(g, t, dur, o.vol || 0.1, o.attack || 0.003);
  src.connect(fl); fl.connect(g); auOut(g, o); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}

function sfx(name, x, y) {
  if (!audioOn()) return;
  const now = AU.ctx.currentTime;
  if (now - (AU.last[name] || -1) < 0.03) return;
  AU.last[name] = now;
  let k = 1, pan = 0;
  if (x !== undefined) { const dx = x - pl.x, d = Math.hypot(dx, y - pl.y); if (d > 330) return; k = 1 - d / 360; pan = clamp(dx / 170, -0.8, 0.8); }
  const T = (f, d, o = {}) => tone(f, d, Object.assign(o, { vol: (o.vol || 0.1) * k, pan }));
  const N = (d, o = {}) => noise(d, Object.assign(o, { vol: (o.vol || 0.1) * k, pan }));
  const r = 0.94 + Math.random() * 0.12;
  switch (name) {
    case 'swing': N(0.13, { f: 700 * r, to: 2600, q: 1.4, vol: 0.16, attack: 0.02 }); break;
    case 'swing3': N(0.22, { f: 350, to: 2200, q: 1.2, vol: 0.24, attack: 0.03 }); T(140, 0.18, { to: 70, vol: 0.08 }); break;
    case 'hit': N(0.09, { type: 'lowpass', f: 1800 * r, to: 300, vol: 0.3 }); T(190 * r, 0.1, { type: 'square', to: 80, vol: 0.09 }); break;
    case 'crit': N(0.12, { type: 'lowpass', f: 2600, to: 300, vol: 0.34 }); T(160, 0.14, { type: 'square', to: 60, vol: 0.11 }); T(1760, 0.25, { vol: 0.07 }); T(2640, 0.2, { vol: 0.04, delay: 0.03 }); break;
    case 'kill': T(260 * r, 0.3, { type: 'sawtooth', to: 50, vol: 0.1 }); N(0.3, { type: 'lowpass', f: 1400, to: 150, vol: 0.22 }); break;
    case 'bolt': T(880 * r, 0.16, { type: 'triangle', to: 260, vol: 0.09 }); N(0.2, { f: 2400, to: 600, q: 0.8, vol: 0.12, attack: 0.02 }); break;
    case 'boltHit': N(0.2, { type: 'lowpass', f: 1500, to: 200, vol: 0.22 }); T(210, 0.16, { to: 60, vol: 0.12 }); break;
    case 'shot': T(300 * r, 0.2, { type: 'square', to: 520, vol: 0.05 }); T(303 * r, 0.2, { type: 'square', to: 530, vol: 0.05 }); break;
    case 'charge': T(180, 0.5, { type: 'sawtooth', to: 620, vol: 0.05, attack: 0.3 }); break;
    case 'dash': N(0.2, { type: 'highpass', f: 3200, to: 500, vol: 0.14 }); T(480, 0.14, { to: 960, vol: 0.05 }); break;
    case 'nova': T(130, 0.7, { to: 36, vol: 0.4 }); N(0.8, { type: 'lowpass', f: 5000, to: 180, vol: 0.4 }); T(1320, 0.5, { vol: 0.05, delay: 0.05 }); T(1976, 0.6, { vol: 0.04, delay: 0.1 }); break;
    case 'hurt': T(230, 0.25, { type: 'sawtooth', to: 90, vol: 0.16 }); N(0.14, { type: 'lowpass', f: 900, vol: 0.25 }); break;
    case 'coin': T(1318 * r, 0.09, { vol: 0.07 }); T(1760 * r, 0.22, { vol: 0.07, delay: 0.06 }); break;
    case 'heal': [523, 659, 784, 1047].forEach((f, i) => T(f, 0.3, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); break;
    case 'mana': T(880, 0.3, { to: 1320, vol: 0.08 }); T(1320, 0.4, { vol: 0.04, delay: 0.1 }); break;
    case 'xp': T(1100 + Math.random() * 500, 0.08, { vol: 0.035 }); break;
    case 'levelup': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => { T(f, 0.6, { type: 'triangle', vol: 0.11, delay: i * 0.09 }); T(f * 2, 0.5, { vol: 0.03, delay: i * 0.09 + 0.02 }); }); N(1.2, { type: 'highpass', f: 5000, to: 9000, vol: 0.05, attack: 0.5 }); break;
    case 'perk': [659, 988, 1319].forEach((f, i) => T(f, 0.5, { type: 'triangle', vol: 0.1, delay: i * 0.08 })); break;
    case 'brazier': N(0.9, { type: 'lowpass', f: 200, to: 3600, vol: 0.34, attack: 0.25 }); T(70, 0.8, { to: 170, vol: 0.22, attack: 0.2 }); for (let i = 0; i < 6; i++) N(0.03, { type: 'highpass', f: 3000, vol: 0.12, delay: 0.3 + Math.random() * 0.7 }); T(587, 1.2, { vol: 0.05, delay: 0.3 }); T(880, 1.4, { vol: 0.05, delay: 0.45 }); break;
    case 'chest': T(90, 0.35, { type: 'sawtooth', to: 140, vol: 0.06 }); N(0.12, { f: 500, vol: 0.2, delay: 0.3 }); [784, 988, 1175, 1568].forEach((f, i) => T(f, 0.4, { vol: 0.06, delay: 0.35 + i * 0.06 })); break;
    case 'break': N(0.16, { f: 650 * r, q: 0.8, vol: 0.34 }); for (let i = 0; i < 3; i++) T(240 + Math.random() * 300, 0.04, { type: 'square', vol: 0.06, delay: 0.02 + i * 0.04 }); break;
    case 'step': N(0.05, { type: 'lowpass', f: 320 * r, vol: 0.09 }); break;
    case 'wade': N(0.14, { f: 1300 * r, q: 0.7, vol: 0.09, attack: 0.02 }); break;
    case 'spike': T(1900 * r, 0.09, { type: 'square', vol: 0.04 }); N(0.07, { type: 'highpass', f: 4200, vol: 0.14 }); break;
    case 'seal': T(55, 1.6, { to: 36, vol: 0.35, attack: 0.3 }); [294, 440, 587, 880].forEach((f, i) => T(f, 1.6, { vol: 0.07, delay: 0.2 + i * 0.18, attack: 0.1 })); N(1.4, { type: 'lowpass', f: 300, vol: 0.25, attack: 0.4 }); break;
    case 'descend': T(220, 1.4, { to: 45, vol: 0.2 }); N(1.5, { type: 'lowpass', f: 2400, to: 120, vol: 0.2, attack: 0.3 }); break;
    case 'roar': T(82, 1.3, { type: 'sawtooth', to: 38, vol: 0.3, attack: 0.1 }); T(87, 1.3, { type: 'sawtooth', to: 41, vol: 0.25, attack: 0.1 }); N(1.3, { type: 'lowpass', f: 700, to: 200, vol: 0.4, attack: 0.15 }); break;
    case 'death': [440, 349, 294, 220, 147].forEach((f, i) => T(f, 0.9, { type: 'triangle', vol: 0.12, delay: i * 0.22 })); T(60, 2, { to: 30, vol: 0.35, delay: 0.3 }); break;
    case 'victory': [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => { T(f, 0.7, { type: 'triangle', vol: 0.12, delay: i * 0.16 }); T(f / 2, 0.7, { vol: 0.06, delay: i * 0.16 }); }); break;
    case 'drip': T(1500 * r, 0.05, { to: 700, vol: 0.05 }); break;
    case 'ember': N(0.04, { type: 'highpass', f: 2500 * r, vol: 0.05 }); break;
    case 'potion': N(0.3, { f: 900, to: 1800, q: 3, vol: 0.14, attack: 0.05 }); T(660, 0.4, { to: 990, vol: 0.07, delay: 0.15 }); break;
    case 'deny': T(160, 0.12, { type: 'square', vol: 0.05 }); T(120, 0.16, { type: 'square', vol: 0.05, delay: 0.1 }); break;
    case 'uiMove': T(620, 0.05, { vol: 0.05 }); break;
    case 'uiOk': T(520, 0.08, { type: 'triangle', vol: 0.09 }); T(1040, 0.2, { type: 'triangle', vol: 0.07, delay: 0.05 }); break;
    case 'uiBack': T(520, 0.08, { type: 'triangle', vol: 0.07 }); T(390, 0.16, { type: 'triangle', vol: 0.06, delay: 0.05 }); break;
    case 'sting': T(49, 3.2, { vol: 0.4, attack: 0.6 }); [147, 220, 294, 440, 587].forEach((f, i) => T(f, 3, { type: 'triangle', vol: 0.07, delay: 0.3 + i * 0.22, attack: 0.3 })); N(2.6, { type: 'lowpass', f: 200, to: 4200, vol: 0.14, attack: 1.4 }); N(0.5, { type: 'highpass', f: 6000, vol: 0.06, delay: 1.5 }); break;
  }
}

/* ---------- soundtrack ---------- */
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const PENT = [0, 3, 5, 7, 10, 12, 15, 17];
// chords: [root midi, 'm' | 'M']; arp: 16 step mask; lead: per-bar [step, scale degree] or 'gen' for improvised phrases
const SONGS = {
  menu: { bpm: 60, key: 50, chords: [[50, 'm'], [46, 'M'], [53, 'M'], [48, 'M']], arp: '1001001010010010', pad: 0.05, amb: 0.05,
    lead: [[[0, 4], [6, 3], [8, 2], [12, 3]], [[0, 2], [8, 0]], [[0, 3], [4, 4], [8, 5], [12, 4]], [[0, 2], [6, 1], [8, 0]]] },
  b0: { bpm: 76, key: 45, chords: [[45, 'm'], [41, 'M'], [50, 'm'], [40, 'M']], arp: '1000001000100000', pad: 0.045, amb: 0.07, lead: 'gen' },
  b1: { bpm: 70, key: 52, chords: [[52, 'm'], [48, 'M'], [43, 'M'], [50, 'M']], arp: '1010010010100100', pad: 0.04, amb: 0.06, lead: 'gen' },
  b2: { bpm: 84, key: 48, chords: [[48, 'm'], [44, 'M'], [41, 'm'], [43, 'M']], arp: '1000100010001010', pad: 0.05, amb: 0.09, lead: 'gen' },
  boss: { bpm: 138, key: 50, chords: [[50, 'm'], [50, 'm'], [46, 'M'], [45, 'M']], arp: '1011011010110110', pad: 0.05, amb: 0.05, lead: 'gen', drive: 1 },
};
const MUS = { mode: 'none', want: 'none', step: 0, next: 0, inten: 0, intenT: 0, deg: 2 };
const musicSet = m => { MUS.want = m; };

function musPad(m, t, dur, vol) {
  const c = AU.ctx, fl = c.createBiquadFilter(), g = c.createGain();
  fl.type = 'lowpass'; fl.frequency.setValueAtTime(380, t); fl.frequency.linearRampToValueAtTime(900, t + dur * 0.5); fl.frequency.linearRampToValueAtTime(420, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  for (const det of [-7, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur + 0.05); }
  fl.connect(g); g.connect(AU.mus);
}
function musStep(S, step, t, spb) {
  const bar = Math.floor(step / 16), s = step % 16, ch = S.chords[bar % S.chords.length], root = ch[0], iv = ch[1] === 'm' ? [0, 3, 7] : [0, 4, 7];
  const I = S.drive || MUS.inten, bus = AU.mus;
  if (s === 0) {
    for (const n of [root, root + iv[1], root + iv[2], root + 12]) musPad(n, t, spb * 18, S.pad);
    tone(mtof(root - 12), spb * 15, { at: t, vol: 0.16, attack: 0.08, bus });
    tone(mtof(root - 12), spb * 15, { at: t, type: 'triangle', vol: 0.06, attack: 0.08, bus });
  }
  if (S.arp[s] === '1' && (S.drive || Math.random() < 0.8)) {
    const n = root + 12 + iv[(step * 5 + bar) % 3] + (Math.random() < 0.3 ? 12 : 0);
    tone(mtof(n), 0.5, { at: t, type: 'triangle', vol: 0.05, bus: AU.delay });
    tone(mtof(n) * 2, 0.2, { at: t, vol: 0.012, bus: AU.delay });
  }
  let note = -1;
  if (S.lead === 'gen') {   // improvised pentatonic phrases every other pair of bars
    if (bar % 4 >= 2 && s % 4 === 0 && Math.random() < 0.6) { MUS.deg = clamp(MUS.deg + Math.floor(Math.random() * 5) - 2, 0, 7); note = S.key + 12 + PENT[MUS.deg]; }
  } else for (const [ls, dg] of S.lead[bar % S.lead.length]) if (ls === s) note = S.key + 12 + PENT[dg];
  if (note >= 0) {
    tone(mtof(note), 1.6, { at: t, vol: 0.06, attack: 0.01, bus });
    tone(mtof(note) * 2.01, 0.9, { at: t, vol: 0.02, bus });
    tone(mtof(note) * 3, 0.4, { at: t, vol: 0.008, bus });
  }
  if (I > 0.12) {   // combat layer: drums and a pulsing bass fade in with danger
    const v = Math.min(1, I);
    if (s % 8 === 0 || (S.drive && (s === 6 || s === 10))) { tone(130, 0.2, { at: t, to: 40, vol: 0.4 * v, bus }); noise(0.03, { at: t, type: 'lowpass', f: 900, vol: 0.12 * v, bus }); }
    if (s % 8 === 4) { noise(0.14, { at: t, f: 1700, q: 0.7, vol: 0.16 * v, bus }); tone(190, 0.08, { at: t, to: 120, vol: 0.08 * v, bus }); }
    if (s % 2 === 0) noise(0.03, { at: t, type: 'highpass', f: 7000, vol: (s % 4 === 2 ? 0.05 : 0.025) * v, bus });
    if (s % 2 === 0) tone(mtof(root - 12 + (s % 8 === 6 ? 7 : 0)), spb * 1.7, { at: t, type: 'sawtooth', vol: 0.045 * v, bus });
    if (s === 14 && Math.random() < 0.5) tone(110, 0.15, { at: t, to: 70, vol: 0.2 * v, bus });
  }
}
function musicTick() {
  if (!audioOn()) return;
  const c = AU.ctx;
  if (MUS.mode !== MUS.want && (MUS.step % 16 === 0 || MUS.mode === 'none')) { MUS.mode = MUS.want; MUS.step = 0; }
  MUS.inten += (MUS.intenT - MUS.inten) * 0.03;
  const S = SONGS[MUS.mode];
  AU.amb.gain.setTargetAtTime(S ? S.amb : 0, c.currentTime, 0.5);
  if (!S) return;
  if (MUS.next < c.currentTime) MUS.next = c.currentTime + 0.06;
  const spb = 60 / S.bpm / 4;
  while (MUS.next < c.currentTime + 0.3) { musStep(S, MUS.step, MUS.next, spb); MUS.next += spb; MUS.step++; }
}
