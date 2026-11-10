'use strict';
/* WebGL pipeline: 2D canvases (colour + data) -> deferred lighting -> bloom -> composite */
const albCv = mk(VW, VH), ac = albCv.getContext('2d'), datCv = mk(VW, VH), dc = datCv.getContext('2d');
ac.imageSmoothingEnabled = dc.imageSmoothingEnabled = false;
const glCv = document.getElementById('gl');
const gl = glCv.getContext('webgl', { antialias: false, alpha: false });
let glErr = '';
const NL = 20, BW = VW / 2, BH = VH / 2;
// Surface kinds stored in the data canvas green channel.
const K_FLOOR = 0, K_LAVA = 32, K_TOP = 64, K_PIT = 96, K_FRONT = 128, K_SPR = 192, K_WATER = 255;

const VS = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }';
const FS_HEAD = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
const vec2 RES = vec2(${VW}., ${VH}.);
float b2(vec2 a) { a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
float bayer(vec2 a) { return b2(.5 * a) * .25 + b2(a); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { return noise(p) * .5 + noise(p * 2.03 + 7.) * .3 + noise(p * 4.1 + 13.) * .2; }
`;

const FS_SCENE = FS_HEAD + `
uniform sampler2D uAlb, uDat, uMap;
uniform vec2 uCam, uMapSize;
uniform vec3 uLP[${NL}], uLC[${NL}];   // xy world position, z radius / rgb colour
uniform vec3 uAmb, uAbyss;
uniform float uTime, uSteps;

float solid(vec2 w) { return texture2D(uMap, w / (16. * uMapSize)).r; }
float lum(vec2 p) { return dot(texture2D(uAlb, (p + .5) / RES).rgb, vec3(.333)); }

void main() {
  vec2 px = floor(vec2(vUv.x, 1. - vUv.y) * RES);
  vec4 d = texture2D(uDat, (px + .5) / RES);
  float h = d.r * 255. / 8., k = d.g, em = d.b;
  bool isFloor = k < .06, isLava = k > .08 && k < .18, isTop = k > .2 && k < .3, isPit = k > .33 && k < .42;
  bool isFront = k > .45 && k < .55, isSpr = k > .7 && k < .8, isWater = k > .9;
  float depth = 0.;
  if (isPit) { depth = d.r * 255. / 5.; h = 0.; }
  // Every pixel is projected back onto the ground plane: screen y + height.
  vec2 g = uCam + px + .5 + vec2(0., h);
  vec2 sp = px;
  if (isWater) sp += floor(vec2(sin(g.y * .45 + uTime * 2.2), cos(g.x * .4 + uTime * 1.8)) * 1.3 + .5);
  vec3 alb = texture2D(uAlb, (sp + .5) / RES).rgb;
  if (isLava) {
    vec2 q = g * .055;
    float n = fbm(q + vec2(uTime * .05, uTime * .03));
    float n2 = fbm(q * 2.2 - vec2(uTime * .04, 0.) + n * 1.5);
    float t = smoothstep(.34, .7, n2);
    alb = mix(vec3(.2, .03, .01), vec3(1., .42, .06), t);
    alb = mix(alb, vec3(1., .88, .42), smoothstep(.68, .86, n2));
    em = .45 + .55 * t;
  }
  // Relief normal derived from the pixel art itself.
  vec2 gr = vec2(lum(sp + vec2(1., 0.)) - lum(sp - vec2(1., 0.)), lum(sp + vec2(0., 1.)) - lum(sp - vec2(0., 1.)));
  vec3 n = normalize(vec3(-gr * 3.5, 1.));
  float dth = bayer(px);

  vec3 lit = uAmb, haze = vec3(0.);
  float spec = 0.;
  for (int i = 0; i < ${NL}; i++) {
    vec3 L = uLP[i];
    if (L.z <= 0.) continue;
    vec2 dv = L.xy - g;
    float dist = length(dv);
    if (dist >= L.z) continue;
    float att = 1. - dist / L.z; att *= att;
    float f = 1.;
    if (isTop) f = .5;                             // wall tops sit above every occluder
    else {
      if (isFront) f = clamp(dv.y / 5., 0., 1.);   // south faces only catch light from the south
      if (f > 0.) for (int s = 0; s < 20; s++) {   // dithered shadow ray through the wall grid
        if (float(s) >= uSteps) break;
        if (solid(g + dv * ((float(s) + dth) / uSteps)) > .5) { f = 0.; break; }
      }
    }
    haze += uLC[i] * att * att * (isTop ? 1. : .2 + .8 * f);
    float nl = 1.;
    vec2 ld = normalize(dv + .001);
    if (isFloor || isTop || isWater) nl = clamp(dot(n, normalize(vec3(dv, 14.))) * 1.25, 0., 1.5);
    else if (isSpr) nl = mix(.45, 1.1, clamp(dv.y / 24. + .55, 0., 1.)) * (1. + dot(n.xy, ld) * .35);   // back-lit figures read as silhouettes
    else if (isFront) nl = 1. + dot(n.xy, ld) * .3;
    else if (isPit) nl = exp(-depth * .07);
    lit += uLC[i] * att * f * nl * 1.6;
    spec += att * f;
  }
  vec3 col = alb * lit;
  if (isWater) {
    float w = sin(g.x * .9 + g.y * .35 + uTime * 3.) * sin(g.y * 1.1 - uTime * 2.);
    col += step(.82, w) * spec * vec3(.45, .65, .85) + alb * uAmb * .6;
  }
  if (isPit) {   // fog glowing up from the abyss
    float fogk = smoothstep(6., 44., depth), nz = noise(g * .07 + vec2(uTime * .2, -uTime * .15));
    col = mix(col, uAbyss * (.35 + .65 * nz), fogk);
    em = max(em, fogk * .3 * nz);
  }
  col = mix(col, alb * 1.3, em) + haze * .06;
  gl_FragColor = vec4(col, em);
}`;

const FS_BLUR = FS_HEAD + `
uniform sampler2D uTex; uniform vec2 uDir; uniform float uExtract;
vec3 tap(vec2 uv) {
  vec4 c = texture2D(uTex, uv);
  if (uExtract > .5) { float l = max(c.r, max(c.g, c.b)); c.rgb *= c.a * .9 + smoothstep(.62, 1., l) * .45; }
  return c.rgb;
}
void main() {
  vec3 c = tap(vUv) * .227;
  c += (tap(vUv + uDir) + tap(vUv - uDir)) * .1946;
  c += (tap(vUv + uDir * 2.) + tap(vUv - uDir * 2.)) * .1216;
  c += (tap(vUv + uDir * 3.) + tap(vUv - uDir * 3.)) * .0541;
  c += (tap(vUv + uDir * 4.) + tap(vUv - uDir * 4.)) * .0162;
  gl_FragColor = vec4(c, 1.);
}`;

const FS_POST = FS_HEAD + `
uniform sampler2D uScene, uBloom;
uniform float uTime, uHurt, uFade, uBloomK, uDither, uLow, uAb, uFlash;
uniform vec3 uGrade;
void main() {
  vec2 q = vUv - .5; float r2 = dot(q, q);
  vec2 o = q * uAb * .014;
  vec3 col = vec3(texture2D(uScene, vUv + o).r, texture2D(uScene, vUv).g, texture2D(uScene, vUv - o).b);
  col += texture2D(uBloom, vUv).rgb * uBloomK;
  col = mix(vec3(dot(col, vec3(.3, .59, .11))), col, 1.14) * uGrade;
  col = col / (1. + col * .18) * 1.16;
  col *= 1. - r2 * 1.05;
  col = mix(col, vec3(.45, 0., .02), clamp(uLow * r2 * 1.7 * (.65 + .35 * sin(uTime * 5.)), 0., 1.));
  col = mix(col, vec3(.9, .05, .05), clamp(uHurt * r2 * 2.6, 0., 1.));
  col += uFlash * vec3(1., .85, .6) * .55;
  col *= uFade;
  col = clamp(col, 0., 1.);
  if (uDither > .5) {   // ordered-dither posterise in perceptual space
    col = sqrt(col);
    col = floor(col * 15. + bayer(floor(vUv * RES))) / 15.;
    col *= col;
  }
  gl_FragColor = vec4(col, 1.);
}`;

const GFX = {};
function gfxInit() {
  if (!gl) { glErr = 'WebGL недоступен в этом браузере'; return; }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) glErr = glErr || gl.getShaderInfoLog(s); return s; };
  const vs = sh(gl.VERTEX_SHADER, VS);
  const prog = fs => {
    const p = gl.createProgram(), u = {};
    gl.attachShader(p, vs); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) glErr = glErr || gl.getProgramInfoLog(p) || 'shader link failed';
    return { p, u: n => n in u ? u[n] : (u[n] = gl.getUniformLocation(p, n)) };
  };
  GFX.scene = prog(FS_SCENE); GFX.blur = prog(FS_BLUR); GFX.post = prog(FS_POST);
  if (glErr) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  const tex = (unit, filter, w, h) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  };
  const fbo = (unit, filter, w, h) => {
    const t = tex(unit, filter, w, h), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { fb, unit, w, h };
  };
  // Texture units stay bound for the whole session: 0 colour, 1 data, 2 wall grid, 3 lit scene, 4/5 bloom.
  tex(0, gl.NEAREST); tex(1, gl.NEAREST); tex(2, gl.NEAREST);
  GFX.fScene = fbo(3, gl.NEAREST, VW, VH); GFX.fA = fbo(4, gl.LINEAR, BW, BH); GFX.fB = fbo(5, gl.LINEAR, BW, BH);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  GFX.ok = true;
}

function gfxSetMap(bytes) {
  if (!GFX.ok) return;
  gl.activeTexture(gl.TEXTURE2);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, MW, MH, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
}

// o: { cam, LP, LC, amb, abyss, grade, time, hurt, fade, low, ab, flash }
function gfxRender(o) {
  if (!GFX.ok) return;
  const draw = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.activeTexture(gl.TEXTURE0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, albCv);
  gl.activeTexture(gl.TEXTURE1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, datCv);

  let P = GFX.scene; gl.useProgram(P.p);
  gl.bindFramebuffer(gl.FRAMEBUFFER, GFX.fScene.fb); gl.viewport(0, 0, VW, VH);
  gl.uniform1i(P.u('uAlb'), 0); gl.uniform1i(P.u('uDat'), 1); gl.uniform1i(P.u('uMap'), 2);
  gl.uniform2f(P.u('uCam'), o.cam.x, o.cam.y); gl.uniform2f(P.u('uMapSize'), MW, MH);
  gl.uniform3fv(P.u('uLP'), o.LP); gl.uniform3fv(P.u('uLC'), o.LC);
  gl.uniform3fv(P.u('uAmb'), o.amb); gl.uniform3fv(P.u('uAbyss'), o.abyss);
  gl.uniform1f(P.u('uTime'), o.time % 1000); gl.uniform1f(P.u('uSteps'), [8, 14, 20][SET.quality]);
  draw();

  if (SET.bloom) {
    P = GFX.blur; gl.useProgram(P.p); gl.viewport(0, 0, BW, BH);
    const pass = (src, dst, dx, dy, extract) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.uniform1i(P.u('uTex'), src.unit);
      gl.uniform2f(P.u('uDir'), dx / BW, dy / BH); gl.uniform1f(P.u('uExtract'), extract); draw();
    };
    pass(GFX.fScene, GFX.fA, 1, 0, 1); pass(GFX.fA, GFX.fB, 0, 1, 0);
    if (SET.quality > 0) { pass(GFX.fB, GFX.fA, 2.2, 0, 0); pass(GFX.fA, GFX.fB, 0, 2.2, 0); }
  }

  P = GFX.post; gl.useProgram(P.p);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, glCv.width, glCv.height);
  gl.uniform1i(P.u('uScene'), 3); gl.uniform1i(P.u('uBloom'), 5);
  gl.uniform1f(P.u('uTime'), o.time % 1000); gl.uniform1f(P.u('uHurt'), o.hurt); gl.uniform1f(P.u('uFade'), o.fade);
  gl.uniform1f(P.u('uBloomK'), SET.bloom ? 1.25 : 0); gl.uniform1f(P.u('uDither'), SET.dither ? 1 : 0);
  gl.uniform1f(P.u('uLow'), o.low); gl.uniform1f(P.u('uAb'), o.ab); gl.uniform1f(P.u('uFlash'), o.flash);
  gl.uniform3fv(P.u('uGrade'), o.grade);
  draw();
}
gfxInit();
