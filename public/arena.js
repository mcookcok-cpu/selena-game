import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = s => document.querySelector(s);
const touch = matchMedia('(pointer:coarse)').matches;
if (touch) document.body.classList.add('touch');

// ---------------------------------------------------------------- konfigurasi
const CFG = { runSpeed: 3.4, fastSpeed: 5.2, runRef: 2.6, fastRef: 3.3, arenaR: 26.5, gravity: 24, jumpV: 8.5, maxHp: 100 };
// hit/cancel = fraksi durasi klip; dash = [mulai, selesai] fraksi, dashLen = jarak (m)
const ACT = {
  attack1: { clip: 'attack1', speed: 1.5, hit: 0.35, cancel: 0.7, dmg: 14, range: 2.6, arc: 150 },
  attack2: { clip: 'attack2', speed: 1.5, hit: 0.4, cancel: 0.75, dmg: 18, range: 2.8, arc: 160 },
  skill1: { clip: 'skill1', speed: 1.2, hit: 0.4, cancel: 0.9, dmg: 28, range: 4.2, arc: 360, cd: 4, ring: true },
  skill2: { clip: 'skill2', speed: 1.2, hit: 0.35, cancel: 0.9, dmg: 22, range: 3.4, arc: 100, cd: 6, dash: [0.12, 0.5], dashLen: 3.6 },
};
const F1 = ['face01', 'body01', 'hair01', 'qunzi01', 'leg_01'], F2 = ['body02', 'face02', 'hair02'];
const KEYS = [...F1, ...F2];

// ---------------------------------------------------------------- renderer / scene
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, touch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b0a14, 0.02);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
const composer = new EffectComposer(renderer);
composer.renderTarget1.samples = 4; composer.renderTarget2.samples = 4;
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.6, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color('#1b0f3a') }, mid: { value: new THREE.Color('#2b1458') }, bot: { value: new THREE.Color('#07060d') } },
  vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top,mid,bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c=mix(bot,mid,smoothstep(-.25,.2,h)); c=mix(c,top,smoothstep(.15,.9,h)); gl_FragColor=vec4(c,1.); }',
}));
scene.add(sky);
{ const n = 600, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = Math.random(), t = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u) * 140; a[i*3] = Math.cos(t) * r; a[i*3+1] = u * 140 + 6; a[i*3+2] = Math.sin(t) * r; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.0, color: 0xcfc4ff, fog: false, transparent: true, opacity: 0.8, sizeAttenuation: false, depthWrite: false }))); }

scene.add(new THREE.HemisphereLight(0x8b7bff, 0x1a1030, 0.55));
const sun = new THREE.DirectionalLight(0xf2e8ff, 2.2);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
scene.add(sun, sun.target);
const rim = new THREE.PointLight(0x8b5cf6, 14, 12, 2); scene.add(rim);

// lantai arena bertekstur rune
const floorTex = (() => {
  const s = 1024, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  g.fillStyle = '#0b0a18'; g.fillRect(0, 0, s, s); g.translate(s / 2, s / 2);
  g.strokeStyle = 'rgba(139,92,246,.55)'; g.lineWidth = 3;
  for (const r of [0.97, 0.9, 0.62, 0.34, 0.12]) { g.beginPath(); g.arc(0, 0, r * s / 2, 0, 7); g.stroke(); }
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(139,92,246,.35)';
  for (let i = 0; i < 24; i++) { g.save(); g.rotate(i * Math.PI / 12); g.beginPath(); g.moveTo(0.34 * s / 2, 0); g.lineTo(0.9 * s / 2, 0); g.stroke(); g.restore(); }
  g.strokeStyle = 'rgba(196,181,253,.5)'; g.lineWidth = 2.5;
  for (const n of [5, 7]) { g.beginPath(); for (let i = 0; i <= n; i++) { const a = (i * 2 * Math.PI * 2 / n) - Math.PI / 2, r = (n === 5 ? 0.3 : 0.58) * s / 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
})();
const floor = new THREE.Mesh(new THREE.CircleGeometry(CFG.arenaR + 1.5, 96), new THREE.MeshStandardMaterial({ map: floorTex, emissiveMap: floorTex, emissive: 0x6d3df0, emissiveIntensity: 0.55, metalness: 0.55, roughness: 0.35 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const outer = new THREE.Mesh(new THREE.CircleGeometry(150, 48), new THREE.MeshStandardMaterial({ color: 0x07060f, roughness: 1 }));
outer.rotation.x = -Math.PI / 2; outer.position.y = -0.03; scene.add(outer);
const edge = new THREE.Mesh(new THREE.TorusGeometry(CFG.arenaR + 1.2, 0.09, 8, 128), new THREE.MeshBasicMaterial({ color: 0x8b5cf6, toneMapped: false }));
edge.rotation.x = Math.PI / 2; edge.position.y = 0.05; scene.add(edge);
const pillars = [];
for (let i = 0; i < 10; i++) {
  const a = i / 10 * Math.PI * 2 + 0.15, x = Math.cos(a) * 20, z = Math.sin(a) * 20;
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 6, 10), new THREE.MeshStandardMaterial({ color: 0x1b1530, metalness: 0.6, roughness: 0.4 }));
  p.position.set(x, 3, z); p.castShadow = p.receiveShadow = true; scene.add(p);
  const cap = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 8, 24), new THREE.MeshBasicMaterial({ color: 0xa78bfa, toneMapped: false }));
  cap.rotation.x = Math.PI / 2; cap.position.set(x, 5.9, z); scene.add(cap);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshBasicMaterial({ color: 0xc4b5fd, toneMapped: false }));
  orb.position.set(x, 6.6, z); scene.add(orb);
  pillars.push({ x, z, r: 0.85 });
}

// ---------------------------------------------------------------- partikel & efek
const NP = 500, pPos = new Float32Array(NP * 3).fill(-100), pCol = new Float32Array(NP * 3), pBase = new Float32Array(NP * 3), pVel = new Float32Array(NP * 3), pLife = new Float32Array(NP);
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
points.frustumCulled = false; scene.add(points);
let pIdx = 0;
function burst(p, hex, n = 20, spd = 4, up = 2) {
  const c = new THREE.Color(hex);
  for (let i = 0; i < n; i++) {
    const k = pIdx++ % NP, a = Math.random() * 6.283, s = spd * (0.3 + Math.random());
    pPos[k*3] = p.x; pPos[k*3+1] = p.y; pPos[k*3+2] = p.z;
    pVel[k*3] = Math.cos(a) * s; pVel[k*3+1] = up * Math.random() + 0.5; pVel[k*3+2] = Math.sin(a) * s;
    pBase[k*3] = c.r; pBase[k*3+1] = c.g; pBase[k*3+2] = c.b; pLife[k] = 0.5 + Math.random() * 0.5;
  }
}
function updateParticles(dt) {
  for (let k = 0; k < NP; k++) {
    if (pLife[k] <= 0) continue;
    pLife[k] -= dt; const l = Math.max(0, pLife[k]);
    if (l === 0) { pPos[k*3+1] = -100; continue; }
    pVel[k*3+1] -= 6 * dt; pPos[k*3] += pVel[k*3] * dt; pPos[k*3+1] += pVel[k*3+1] * dt; pPos[k*3+2] += pVel[k*3+2] * dt;
    const f = Math.min(1, l * 2); pCol[k*3] = pBase[k*3] * f; pCol[k*3+1] = pBase[k*3+1] * f; pCol[k*3+2] = pBase[k*3+2] * f;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}
const fxList = [];
function ringFx(pos, radius) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.08, pos.z); scene.add(m); fxList.push({ m, t: 0, dur: 0.45, r: radius });
}
function updateFx(dt) {
  for (let i = fxList.length - 1; i >= 0; i--) {
    const f = fxList[i]; f.t += dt; const k = f.t / f.dur;
    if (k >= 1) { scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); fxList.splice(i, 1); continue; }
    const s = 0.4 + f.r * (1 - (1 - k) * (1 - k)); f.m.scale.set(s, s, 1); f.m.material.opacity = 0.9 * (1 - k);
  }
}

// ---------------------------------------------------------------- suara
let ac = null;
function sfx(kind) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime, g = ac.createGain(); g.connect(ac.destination);
    if (kind === 'swing') {
      const len = 0.18, b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(500, t + len);
      g.gain.setValueAtTime(0.22, t); s.connect(f); f.connect(g); s.start(t);
    } else {
      const o = ac.createOscillator(); o.type = kind === 'kill' ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(kind === 'kill' ? 520 : 170, t); o.frequency.exponentialRampToValueAtTime(kind === 'kill' ? 120 : 50, t + 0.16);
      g.gain.setValueAtTime(kind === 'hurt' ? 0.35 : 0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); o.start(t); o.stop(t + 0.2);
    }
  } catch {}
}
let voices = [], voiceEl = null;
function playVoice() {
  if (!voices.length || (voiceEl && !voiceEl.paused && !voiceEl.ended)) return;
  const v = voices[(Math.random() * voices.length) | 0]; voiceEl = new Audio(v.f); voiceEl.volume = 0.9; voiceEl.play().catch(() => {});
}

// ---------------------------------------------------------------- model & animasi
const player = new THREE.Group(); scene.add(player);
let model, mixer, cur = null, pel1 = null, bind1 = null; const byKey = {}, actions = {};
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
function findBone(mesh, tail) { const n = s => s.replace(/[ _]/g, ''); return mesh.skeleton.bones.findIndex(b => n(b.name).endsWith(tail)); }

async function loadGLB(url, onp) {
  const res = await fetch(url); if (!res.ok) throw new Error('GLB ' + res.status);
  const total = +res.headers.get('content-length') || 0, rd = res.body.getReader(), chunks = []; let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length; onp(got, total); }
  const buf = new Uint8Array(got); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
  return await new Promise((ok, err) => new GLTFLoader().parse(buf.buffer, '', ok, err));
}
function buildClips(data) {
  const san = n => THREE.PropertyBinding.sanitizeNodeName(n);
  for (const c of data.clips) {
    const tracks = [];
    for (const t of c.tracks) {
      const node = model.getObjectByName(san(t.node)); if (!node) continue;
      tracks.push(t.path === 'position' ? new THREE.VectorKeyframeTrack(`${node.name}.position`, c.times, t.values) : new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, c.times, t.values));
    }
    if (!tracks.length) continue;
    const clip = new THREE.AnimationClip(c.name, c.times[c.times.length - 1], tracks);
    const a = mixer.clipAction(clip); a.loopFlag = c.loop; actions[c.name] = a;
  }
}
function play(name, { fade = 0.15, once = false, speed = 1 } = {}) {
  const a = actions[name]; if (!a) return null;
  a.enabled = true; a.setEffectiveWeight(1); a.setEffectiveTimeScale(speed);
  if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else { a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; }
  if (cur !== a) { a.reset(); a.play(); if (cur) cur.crossFadeTo(a, fade, false); cur = a; }
  else if (once) { a.reset().play(); }
  return a;
}
const clipDur = n => actions[n] ? actions[n].getClip().duration : 1;

// ---------------------------------------------------------------- status permainan
const P = { pos: player.position, yaw: 0, vy: 0, grounded: true, hp: CFG.maxHp, state: 'none', t: 0, dur: 0, act: null, hitDone: false, queued: null, speed: 0, invul: 0, unlock: false, cd: { q: 0, e: 0, b: 0 } };
const G = { wave: 0, score: 0, best: +(localStorage.getItem('selena_best') || 0), spawnT: 1.5, started: false, time: 0 };
const enemies = [];
const keys = {}, queue = []; let sprintBtn = false;
const joy = { x: 0, y: 0, id: null };
const cam = { yaw: Math.PI, pitch: 0.32, dist: 5.6, hold: 0, pos: new THREE.Vector3(), tgt: new THREE.Vector3() };

let msgTimer = 0;
function msg(t, s = 2.2) { const el = $('#msg'); el.textContent = t; el.classList.add('on'); msgTimer = s; }
const hpEl = $('#hp i'), infoEl = $('#info'), hurtEl = $('#hurt');
let hurtT = 0;
function hud(dt) {
  hpEl.style.width = Math.max(0, P.hp / CFG.maxHp * 100) + '%';
  infoEl.textContent = `Gelombang ${G.wave} · Skor ${G.score} · Terbaik ${G.best}`;
  if (msgTimer > 0 && (msgTimer -= dt) <= 0) $('#msg').classList.remove('on');
  if (hurtT > 0) { hurtT -= dt; hurtEl.style.opacity = Math.max(0, hurtT / 0.25); }
  for (const [k, cd] of [['q', ACT.skill1.cd], ['e', ACT.skill2.cd], ['b', 8]]) { const el = document.querySelector('#' + k + ' .cd'); if (el) el.style.height = Math.max(0, P.cd[k] / cd * 100) + '%'; }
}

function startSpawn(clip) {
  P.state = 'spawn'; P.t = 0; P.dur = clipDur(clip); P.invul = P.dur + 0.8; P.unlock = false; P.speed = 0; P.act = null;
  play(clip, { once: true, fade: 0.05 });
}
function toIdle() { P.state = 'idle'; P.act = null; P.queued = null; play('fight_idle', { fade: 0.2 }); }
function faceNearest(range = 7) {
  let best = null, bd = range;
  for (const e of enemies) { const d = Math.hypot(e.m.position.x - P.pos.x, e.m.position.z - P.pos.z); if (d < bd) { bd = d; best = e; } }
  if (best) P.yaw = Math.atan2(best.m.position.x - P.pos.x, best.m.position.z - P.pos.z);
}
function startAct(key) {
  const A = ACT[key]; faceNearest();
  P.state = 'act'; P.act = A; P.actKey = key; P.t = 0; P.dur = clipDur(A.clip) / A.speed; P.hitDone = false; P.queued = null;
  play(A.clip, { once: true, speed: A.speed, fade: 0.08 }); sfx('swing');
  if (A.ring) ringFx(P.pos, A.range);
}
function startRecall() {
  P.state = 'recall'; P.t = 0; P.dur = clipDur('recall'); P.unlock = true; P.cd.b = 8; P.speed = 0;
  play('recall', { once: true, fade: 0.2 }); msg('Pulang ke markas… bergerak atau terkena serangan membatalkan', 3);
}
function cancelRecall() { P.unlock = false; msg('Batal pulang'); toIdle(); }
function hurt(n) {
  if (P.invul > 0 || P.state === 'dead') return;
  P.hp -= n; hurtT = 0.25; sfx('hurt'); if (P.state === 'recall') cancelRecall();
  if (P.hp <= 0) die();
}
function die() {
  P.state = 'dead'; P.t = 0; P.unlock = false; P.speed = 0; P.act = null;
  play('dead', { once: true, fade: 0.1 });
  if (G.score > G.best) { G.best = G.score; localStorage.setItem('selena_best', G.best); }
  msg(`Gugur · Skor ${G.score}`, 3.2);
}
function respawn() {
  for (const e of enemies) { scene.remove(e.m); e.m.material.dispose(); } enemies.length = 0;
  G.wave = 0; G.score = 0; G.spawnT = 2.5; P.hp = CFG.maxHp; P.pos.set(0, 0, 0); P.yaw = 0; P.vy = 0; P.grounded = true; P.cd.q = P.cd.e = P.cd.b = 0;
  startSpawn('landing');
}
function doHit(A) {
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); let n = 0;
  for (const e of enemies) {
    const dx = e.m.position.x - P.pos.x, dz = e.m.position.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > A.range + 0.45) continue;
    if (A.arc < 360 && d > 0.01) { const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d))); if (ang > A.arc * Math.PI / 360) continue; }
    e.hp -= A.dmg; e.flash = 0.18; e.kb.set(dx / (d || 1), 0, dz / (d || 1)).multiplyScalar(6); n++;
    burst(e.m.position, 0xc4b5fd, 10, 3, 2.5);
  }
  if (n) sfx('hit');
}
function spawnEnemy() {
  const a = Math.random() * Math.PI * 2, r = CFG.arenaR - 2;
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ color: 0x1a1030, emissive: 0x7c3aed, emissiveIntensity: 1.4, roughness: 0.4, metalness: 0.3 }));
  m.castShadow = true; m.position.set(Math.cos(a) * r, 1.1, Math.sin(a) * r); scene.add(m);
  enemies.push({ m, hp: 24, max: 24, cd: 1.4, flash: 0, phase: Math.random() * 6.28, kb: new THREE.Vector3() });
  burst(m.position, 0x8b5cf6, 14, 3, 3);
}

function moveInput() {
  let x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), y = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  x += joy.x; y += joy.y; let len = Math.hypot(x, y); if (len > 1) { x /= len; y /= len; len = 1; }
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  return { x: fx * y + (-fz) * x, z: fz * y + fx * x, len };
}
const turn = (a, b, m) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + Math.max(-m, Math.min(m, d)); };
const actNorm = () => (P.state === 'act' ? P.t / P.dur : 0);
const free = () => P.state === 'idle' || P.state === 'move';

function handleInputs() {
  while (queue.length) {
    const k = queue.shift(); if (P.state === 'dead' || P.state === 'spawn' || !G.started) continue;
    const n = actNorm(), canChain = P.state === 'act' && n >= P.act.cancel;
    if (k === 'atk') {
      if (free()) startAct('attack1');
      else if (P.state === 'act' && (P.actKey === 'attack1' || P.actKey === 'attack2') && n > 0.25) P.queued = P.actKey === 'attack1' ? 'attack2' : 'attack1';
    } else if (k === 'q' && P.cd.q <= 0 && (free() || canChain)) { P.cd.q = ACT.skill1.cd; startAct('skill1'); }
    else if (k === 'e' && P.cd.e <= 0 && (free() || canChain)) { P.cd.e = ACT.skill2.cd; startAct('skill2'); }
    else if (k === 'b' && P.cd.b <= 0 && free() && P.grounded) startRecall();
    else if (k === 'jump' && free() && P.grounded) { P.vy = CFG.jumpV; P.grounded = false; }
    else if (k === 'v') playVoice();
  }
}

function update(dt) {
  G.time += dt; P.t += dt; P.invul = Math.max(0, P.invul - dt);
  for (const k in P.cd) P.cd[k] = Math.max(0, P.cd[k] - dt);
  handleInputs();
  const mv = moveInput(); P.mv = mv;
  if (P.state === 'spawn') { if (P.t >= P.dur) toIdle(); }
  else if (P.state === 'dead') { if (P.t >= 3.8) respawn(); }
  else if (P.state === 'recall') {
    if (P.t > 0.4 && mv.len > 0.3) cancelRecall();
    else if (P.t >= P.dur) { P.unlock = false; P.pos.set(0, 0, 0); P.yaw = 0; P.hp = Math.min(CFG.maxHp, P.hp + 35); startSpawn('birth'); msg('Tiba di markas · +35 HP'); }
  } else if (P.state === 'act') {
    const A = P.act, n = P.t / P.dur;
    if (!P.hitDone && n >= A.hit) { P.hitDone = true; doHit(A); }
    if (A.dash && n >= A.dash[0] && n <= A.dash[1]) {
      const sp = A.dashLen / ((A.dash[1] - A.dash[0]) * P.dur); P.pos.x += Math.sin(P.yaw) * sp * dt; P.pos.z += Math.cos(P.yaw) * sp * dt;
      tmpV.set(P.pos.x, 0.5, P.pos.z); burst(tmpV, 0xa78bfa, 2, 1, 1);
    }
    if (n >= A.cancel) { if (P.queued) { startAct(P.queued); } else if (mv.len > 0.3) toIdle(); }
    if (P.state === 'act' && n >= 1) toIdle();
  } else {
    const want = mv.len > 0.05, fast = keys.ShiftLeft || keys.ShiftRight || sprintBtn, base = fast ? CFG.fastSpeed : CFG.runSpeed;
    P.speed += ((want ? base * Math.min(1, mv.len) : 0) - P.speed) * Math.min(1, dt * (want ? 12 : 10));
    if (want) { P.yaw = turn(P.yaw, Math.atan2(mv.x, mv.z), 14 * dt); P.pos.x += mv.x / mv.len * P.speed * dt; P.pos.z += mv.z / mv.len * P.speed * dt; }
    if (P.speed > 0.5) { P.state = 'move'; play(fast ? 'fastrun' : 'run', { fade: 0.15, speed: Math.max(0.5, Math.min(1.8, P.speed / (fast ? CFG.fastRef : CFG.runRef))) * (P.grounded ? 1 : 0.5) }); }
    else { P.state = 'idle'; play('fight_idle', { fade: 0.25 }); }
  }
  // lompat / gravitasi
  if (!P.grounded) { P.vy -= CFG.gravity * dt; P.pos.y += P.vy * dt; if (P.pos.y <= 0) { P.pos.y = 0; P.vy = 0; P.grounded = true; burst(P.pos, 0x8b5cf6, 8, 2, 1); } }
  // batas arena & tiang
  const r = Math.hypot(P.pos.x, P.pos.z); if (r > CFG.arenaR) { P.pos.x *= CFG.arenaR / r; P.pos.z *= CFG.arenaR / r; }
  for (const p of pillars) { const dx = P.pos.x - p.x, dz = P.pos.z - p.z, d = Math.hypot(dx, dz), m = p.r + 0.4; if (d < m && d > 0.001) { P.pos.x = p.x + dx / d * m; P.pos.z = p.z + dz / d * m; } }
  player.rotation.y = P.yaw;

  // gelombang & musuh
  if (G.started && P.state !== 'dead' && P.state !== 'spawn' && enemies.length === 0) {
    G.spawnT -= dt;
    if (G.spawnT <= 0) { G.wave++; const n = Math.min(2 + Math.round(G.wave * 1.5), 16); for (let i = 0; i < n; i++) spawnEnemy(); G.spawnT = 2.2; msg(`Gelombang ${G.wave}`, 1.6); }
  }
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i], p = e.m.position;
    if (e.hp <= 0) { burst(p, 0xa78bfa, 26, 5, 4); sfx('kill'); scene.remove(e.m); e.m.material.dispose(); enemies.splice(i, 1); G.score += 10; P.hp = Math.min(CFG.maxHp, P.hp + 2); continue; }
    tmpV.set(P.pos.x - p.x, 0, P.pos.z - p.z); const d = tmpV.length(); tmpV.normalize();
    if (P.state !== 'dead' && d > 1.2) p.addScaledVector(tmpV, (1.8 + 0.12 * G.wave) * dt);
    for (const o of enemies) { if (o === e) continue; tmpV2.set(p.x - o.m.position.x, 0, p.z - o.m.position.z); const dd = tmpV2.length(); if (dd < 0.9 && dd > 0.001) p.addScaledVector(tmpV2.normalize(), (0.9 - dd) * 3 * dt); }
    p.addScaledVector(e.kb, dt); e.kb.multiplyScalar(Math.max(0, 1 - dt * 9));
    p.y = 1.1 + Math.sin(G.time * 3 + e.phase) * 0.12; e.m.rotation.y += dt * 2; e.m.rotation.x = Math.sin(G.time * 2 + e.phase) * 0.3;
    e.flash = Math.max(0, e.flash - dt); const s = 0.6 + 0.4 * e.hp / e.max; e.m.scale.setScalar(s);
    e.m.material.emissiveIntensity = 1.4 + e.flash * 8;
    e.cd -= dt; if (d < 1.45 && e.cd <= 0 && P.state !== 'dead') { e.cd = 1.4; hurt(3 + G.wave * 0.6); }
  }
  updateParticles(dt); updateFx(dt);
}

// kunci posisi pinggul (tanpa root motion) agar karakter tetap di tempat; gerak dikendalikan game
function applyLock() {
  if (!model) return;
  model.updateMatrixWorld(true);
  let dx = 0, dz = 0;
  if (!P.unlock) { pel1.getWorldPosition(tmpV); model.worldToLocal(tmpV); dx = bind1.x - tmpV.x; dz = bind1.z - tmpV.z; }
  for (const k of F1) if (byKey[k]) byKey[k].position.set(dx, 0, dz);
}

function updateCamera(dt) {
  // kamera ikut berputar ke belakang karakter saat berlari maju (berhenti sejenak setelah pemain menyeret kamera)
  cam.hold = Math.max(0, cam.hold - dt);
  const mv = P.mv;
  if (mv && mv.len > 0.2 && cam.hold <= 0 && (P.state === 'move' || P.state === 'idle')) {
    const c = (mv.x * -Math.sin(cam.yaw) + mv.z * -Math.cos(cam.yaw)) / mv.len;
    if (c > 0.6) cam.yaw = turn(cam.yaw, P.yaw + Math.PI, 1.7 * dt * (c - 0.6) / 0.4);
  }
  if (P.unlock && pel1) { pel1.getWorldPosition(tmpV); cam.tgt.lerp(tmpV, 1 - Math.exp(-6 * dt)); }
  else cam.tgt.lerp(tmpV.set(P.pos.x, P.pos.y + 1.25, P.pos.z), 1 - Math.exp(-12 * dt));
  const cp = Math.cos(cam.pitch);
  tmpV.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp).multiplyScalar(cam.dist).add(cam.tgt);
  if (tmpV.y < 0.25) tmpV.y = 0.25;
  camera.position.copy(tmpV); camera.lookAt(cam.tgt);
  sun.position.set(P.pos.x + 9, 16, P.pos.z + 7); sun.target.position.set(P.pos.x, 0, P.pos.z);
  rim.position.set(P.pos.x - 2, 2.5, P.pos.z - 2);
}

// ---------------------------------------------------------------- input
addEventListener('keydown', e => {
  if (e.repeat) return; keys[e.code] = true;
  const m = { KeyJ: 'atk', KeyQ: 'q', KeyE: 'e', KeyB: 'b', Space: 'jump', KeyV: 'v' }[e.code];
  if (m) { queue.push(m); e.preventDefault(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
let drag = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.4) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, btn: e.button }; canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  cam.hold = 1.5; cam.yaw -= dx * 0.0055; cam.pitch = Math.max(0.03, Math.min(1.25, cam.pitch + dy * 0.0045));
});
const endDrag = e => { if (drag && e.pointerId === drag.id) { if (drag.moved < 6 && e.pointerType === 'mouse' && drag.btn === 0) queue.push('atk'); drag = null; } };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', e => { cam.dist = Math.max(2.5, Math.min(11, cam.dist + e.deltaY * 0.004)); e.preventDefault(); }, { passive: false });
// joystick sentuh
{
  const zone = document.body, knob = $('#knob'), base = $('#joy'); let o = null;
  const setJoy = (cx, cy) => { const dx = cx - o.x, dy = cy - o.y, l = Math.hypot(dx, dy), m = Math.min(1, l / 46); joy.x = l ? dx / l * m : 0; joy.y = l ? -dy / l * m : 0; knob.style.transform = `translate(${joy.x * 46}px,${-joy.y * 46}px)`; };
  zone.addEventListener('touchstart', e => { for (const t of e.changedTouches) { if (joy.id === null && t.clientX < innerWidth * 0.4 && !t.target.closest('.b')) { joy.id = t.identifier; const r = base.getBoundingClientRect(); o = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; setJoy(t.clientX, t.clientY); } } }, { passive: true });
  zone.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === joy.id) setJoy(t.clientX, t.clientY); }, { passive: true });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
  zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
}
for (const [id, k] of [['atk', 'atk'], ['q', 'q'], ['e', 'e'], ['jump', 'jump'], ['b', 'b'], ['v', 'v']]) $('#' + id).addEventListener('pointerdown', e => { e.preventDefault(); queue.push(k); });
{ const s = $('#spr'); s.addEventListener('pointerdown', e => { e.preventDefault(); sprintBtn = true; }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) s.addEventListener(ev, () => { sprintBtn = false; }); }
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// ---------------------------------------------------------------- mulai
async function init() {
  const lm = $('#lmsg'), bar = $('#bar i');
  const gltf = await loadGLB('/models/selena_zenith_hd.glb', (g, t) => { bar.style.width = (t ? g / t * 85 : 40) + '%'; lm.textContent = `Memuat model ${(g / 1e6).toFixed(1)}${t ? ' / ' + (t / 1e6).toFixed(1) : ''} MB`; });
  lm.textContent = 'Menyiapkan rig & animasi…'; bar.style.width = '92%';
  model = gltf.scene; player.add(model);
  model.traverse(o => {
    if (!o.isSkinnedMesh) return; const k = KEYS.find(k => o.name.includes(k)); if (!k) return;
    byKey[k] = o; o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
    o.bindMode = THREE.DetachedBindMode; o.bindMatrixInverse.copy(o.bindMatrix).invert();
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) { m.envMapIntensity = 1.0; if (m.transparent && !m.alphaTest) m.depthWrite = false; if (m.map) m.map.anisotropy = 8; }
    if (k === 'qunzi01') o.renderOrder = 3; if (k === 'hair01') o.renderOrder = 2;
  });
  for (const k of F2) if (byKey[k]) byKey[k].visible = false;  // bentuk 2 tidak dipakai
  const b1 = byKey.body01, i1 = findBone(b1, 'Bip001Pelvis'); pel1 = b1.skeleton.bones[i1];
  bind1 = new THREE.Vector3().setFromMatrixPosition(b1.skeleton.boneInverses[i1].clone().invert());
  mixer = new THREE.AnimationMixer(model);
  const [cd, vd] = await Promise.all([fetch('/data/clips_hd.json', { cache: 'no-cache' }).then(r => r.json()), fetch('/data/voices.json').then(r => r.json()).catch(() => [])]);
  buildClips(cd); voices = vd.filter(v => v.d >= 0.6 && v.d <= 4.5);
  play('fight_idle', { fade: 0 }); applyLock(); cam.tgt.set(0, 1.25, 0);
  bar.style.width = '100%'; lm.textContent = 'Siap';
  const btn = $('#start'); btn.style.display = 'block';
  btn.addEventListener('click', () => { sfx('hit'); $('#loading').classList.add('done'); G.started = true; startSpawn('birth'); msg('Bertahanlah dari gelombang Bayangan', 3.5); }, { once: true });
}
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (mixer && !window.__manual) tick(dt);
  if (!window.__norender) composer.render();
}
function tick(dt) {
  if (G.started) update(dt);
  mixer.update(dt); applyLock(); updateCamera(dt); hud(dt);
}
window.__game = { P, G, enemies, cam, CFG, actions, queue, keys, step: tick, get model() { return model; }, get pel() { return pel1; }, THREE };
init().catch(e => { $('#lmsg').textContent = 'Gagal memuat: ' + e.message; console.error(e); });
requestAnimationFrame(loop);
