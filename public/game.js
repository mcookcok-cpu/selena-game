import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = s => document.querySelector(s);
const touch = matchMedia('(pointer:coarse)').matches;

// ---------------------------------------------------------------- konfigurasi
const CFG = { LW: 2.4, v0: 13, vmax: 30, accel: 0.15, gravity: 30, jumpV: 10.2, slideT: 0.75, spawnZ: -95, standH: 1.85, slideH: 0.9, scorePerM: 10, boardDur: 15, reviveSecs: 5, stumbleWin: 4, dur: { magnet: 8, x2: 8, sneak: 10, jet: 6 } };
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
scene.fog = new THREE.FogExp2(0x120a26, 0.017);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
const composer = new EffectComposer(renderer);
composer.renderTarget1.samples = 4; composer.renderTarget2.samples = 4;
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.6, 0.85));
composer.addPass(new OutputPass());
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;

scene.add(new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color('#1b0f3a') }, mid: { value: new THREE.Color('#3a1a6e') }, bot: { value: new THREE.Color('#120a26') } },
  vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top,mid,bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c=mix(bot,mid,smoothstep(-.1,.18,h)); c=mix(c,top,smoothstep(.12,.8,h)); gl_FragColor=vec4(c,1.); }',
})));
scene.add(new THREE.HemisphereLight(0x9a8bff, 0x1a1030, 0.6));
const sun = new THREE.DirectionalLight(0xf2e8ff, 2.2);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 12, bottom: -22, near: 1, far: 50 });
sun.position.set(5, 14, 6); sun.target.position.set(0, 0, -6); scene.add(sun, sun.target);
const rim = new THREE.PointLight(0xa855f7, 12, 12, 2); rim.position.set(-1.5, 2.6, 2); scene.add(rim);

// ---------------------------------------------------------------- lintasan
const TRACK_LEN = 150, PERIOD = 4;
const trackTex = (() => {
  const w = 512, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#0d0a1c'; g.fillRect(0, 0, w, h);
  const half = 3 * CFG.LW / 2 + 0.6, px = x => (x + half) / (2 * half) * w;
  g.fillStyle = '#16102e'; g.fillRect(px(-3 * CFG.LW / 2), 0, px(3 * CFG.LW / 2) - px(-3 * CFG.LW / 2), h);
  g.strokeStyle = 'rgba(167,139,250,.9)'; g.lineWidth = 5;
  for (const x of [-CFG.LW * 1.5, -CFG.LW * 0.5, CFG.LW * 0.5, CFG.LW * 1.5]) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), h); g.stroke(); }
  g.strokeStyle = 'rgba(124,92,240,.45)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, h - 2); g.lineTo(w, h - 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(1, TRACK_LEN / PERIOD); return t;
})();
const track = new THREE.Mesh(new THREE.PlaneGeometry(2 * (3 * CFG.LW / 2 + 0.6), TRACK_LEN), new THREE.MeshStandardMaterial({ map: trackTex, emissiveMap: trackTex, emissive: 0x7c4dff, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.4 }));
track.rotation.x = -Math.PI / 2; track.position.set(0, 0, -TRACK_LEN / 2 + 14); track.receiveShadow = true; scene.add(track);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x08060f, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.04; scene.add(ground);

const winTex = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#05030c'; g.fillRect(0, 0, 128, 256);
  for (let y = 6; y < 250; y += 16) for (let x = 8; x < 120; x += 20) if (Math.random() < 0.55) { g.fillStyle = ['#a78bfa', '#f0abfc', '#67e8f9', '#fde68a'][(Math.random() * 4) | 0]; g.fillRect(x, y, 10, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const bMat = new THREE.MeshStandardMaterial({ color: 0x14102a, emissiveMap: winTex, emissive: 0xffffff, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.6 });
const bGeo = new THREE.BoxGeometry(1, 1, 1);
const buildings = [];
function placeBuilding(b, z) {
  const w = 4 + Math.random() * 3.5, h = 8 + Math.random() * 18, d = 7;
  b.scale.set(w, h, d); b.position.set(b.userData.side * (6.4 + w / 2 + Math.random() * 1.2), h / 2 - 0.04, z);
}
for (const side of [-1, 1]) for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(bGeo, bMat); b.userData.side = side; placeBuilding(b, -100 + i * 8.2); scene.add(b); buildings.push(b); }
const arches = [];
for (let i = 0; i < 6; i++) {
  const a = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.09, 8, 48, Math.PI), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xa78bfa : 0xf0abfc, toneMapped: false }));
  a.position.set(0, 0, -100 + i * 20); scene.add(a); arches.push(a);
}

// ---------------------------------------------------------------- rintangan, koin, power-up
const obs = [], coins = [], pickups = [];
const lowMat = new THREE.MeshStandardMaterial({ color: 0x2a1650, emissive: 0xdb2777, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.4 });
const stripeMat = new THREE.MeshBasicMaterial({ color: 0xff5fa2, toneMapped: false });
const postMat = new THREE.MeshStandardMaterial({ color: 0x24184a, metalness: 0.6, roughness: 0.35 });
const barMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, toneMapped: false });
const blockMat = new THREE.MeshStandardMaterial({ color: 0x1c1b45, metalness: 0.7, roughness: 0.3, emissive: 0x2d1b69, emissiveIntensity: 0.6 });
const winStripe = new THREE.MeshBasicMaterial({ color: 0xc4b5fd, toneMapped: false });
const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 18); coinGeo.rotateX(Math.PI / 2);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffa400, emissiveIntensity: 1.2, metalness: 0.8, roughness: 0.25 });
const PU = { magnet: { c: 0x38bdf8, n: 'MAGNET' }, x2: { c: 0xfacc15, n: 'SKOR x2' }, sneak: { c: 0x4ade80, n: 'SEPATU LONCAT' }, jet: { c: 0xfb923c, n: 'JETPACK' } };
const puRing = new THREE.TorusGeometry(0.5, 0.07, 8, 24), puCore = new THREE.SphereGeometry(0.26, 16, 12);
function addObs(type, lane, z, len = 6) {
  const g = new THREE.Group(); let hd = 0.3, hw = 1.0;
  if (type === 'low') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 0.5), lowMat); b.position.y = 0.4; b.castShadow = true; g.add(b);
    const s = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.1, 0.54), stripeMat); s.position.y = 0.82; g.add(s); hd = 0.3;
  } else if (type === 'gate') {
    for (const sx of [-0.95, 0.95]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.5, 0.22), postMat); p.position.set(sx, 1.25, 0); p.castShadow = true; g.add(p); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.32, 0.36), barMat); bar.position.y = 1.72; g.add(bar); hd = 0.25;
  } else {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, len), blockMat); b.position.y = 1.4; b.castShadow = b.receiveShadow = true; g.add(b);
    for (const sx of [-1.02, 1.02]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, len * 0.8), winStripe); s.position.set(sx, 1.9, 0); g.add(s); }
    hd = len / 2;
  }
  g.position.set(lane * CFG.LW, 0, z); scene.add(g); const o = { type, lane, x: lane * CFG.LW, z, hd, hw, g, hit: false }; obs.push(o); return o;
}
function addCoin(x, y, z) { const m = new THREE.Mesh(coinGeo, coinMat); m.position.set(x, y, z); scene.add(m); coins.push({ m, x, y, z }); }
function addPickup(type, lane, z) {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: PU[type].c, toneMapped: false });
  g.add(new THREE.Mesh(puRing, mat), new THREE.Mesh(puCore, mat)); g.position.set(lane * CFG.LW, 1.2, z); scene.add(g); pickups.push({ type, g, x: lane * CFG.LW, z });
}
function jetTrail() {
  const n = Math.min(60, Math.ceil(S.speed * CFG.dur.jet / 2.4) + 4);
  for (let k = 0; k < n; k++) addCoin(Math.round(Math.sin(k * 0.32)) * CFG.LW, 4.2, -8 - k * 2.4);
}
function spawnRow() {
  const d = Math.min(1, S.dist / 1800), lanes = [-1, 0, 1], free = lanes[(Math.random() * 3) | 0], z = CFG.spawnZ;
  const blockLen = 4 + Math.random() * 6; let lowLane = null;
  for (const l of lanes) {
    if (l === free) continue;
    if (Math.random() < 0.4 + 0.4 * d) {
      const q = Math.random(), type = q < 0.4 ? 'low' : q < 0.7 ? 'gate' : (Math.random() < 0.35 + 0.4 * d ? 'block' : 'low');
      addObs(type, l, z, blockLen); if (type === 'low') lowLane = l;
    }
  }
  if (Math.random() < 0.65) for (let k = 0; k < 6; k++) addCoin(free * CFG.LW, 1.0, z - 6 + k * 2.0);
  if (lowLane !== null && Math.random() < 0.6) for (let k = 0; k < 5; k++) addCoin(lowLane * CFG.LW, 1.0 + 1.2 * Math.sin(Math.PI * k / 4), z - 4 + k * 2.0);
  if (S.sincePu >= S.nextPu) {
    const r = Math.random(), type = r < 0.3 ? 'magnet' : r < 0.55 ? 'x2' : r < 0.85 ? 'sneak' : 'jet';
    addPickup(type, free, z - 10); S.sincePu = 0; S.nextPu = 140 + Math.random() * 160;
  }
}
function clearWorld() {
  for (const o of obs) scene.remove(o.g); obs.length = 0;
  for (const c of coins) scene.remove(c.m); coins.length = 0;
  for (const p of pickups) scene.remove(p.g); pickups.length = 0;
}

// ---------------------------------------------------------------- partikel
const NP = 400, pPos = new Float32Array(NP * 3).fill(-100), pCol = new Float32Array(NP * 3), pBase = new Float32Array(NP * 3), pVel = new Float32Array(NP * 3), pLife = new Float32Array(NP);
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
points.frustumCulled = false; scene.add(points);
let pIdx = 0;
function burst(p, hex, n = 20, spd = 4, up = 2) {
  const c = new THREE.Color(hex);
  for (let i = 0; i < n; i++) {
    const k = pIdx++ % NP, a = Math.random() * 6.283, s = spd * (0.3 + Math.random());
    pPos[k*3] = p.x; pPos[k*3+1] = p.y; pPos[k*3+2] = p.z; pVel[k*3] = Math.cos(a) * s; pVel[k*3+1] = up * Math.random() + 0.5; pVel[k*3+2] = Math.sin(a) * s;
    pBase[k*3] = c.r; pBase[k*3+1] = c.g; pBase[k*3+2] = c.b; pLife[k] = 0.4 + Math.random() * 0.5;
  }
}
function updateParticles(dt) {
  for (let k = 0; k < NP; k++) {
    if (pLife[k] <= 0) continue; pLife[k] -= dt; const l = Math.max(0, pLife[k]);
    if (l === 0) { pPos[k*3+1] = -100; continue; }
    pVel[k*3+1] -= 8 * dt; pPos[k*3] += pVel[k*3] * dt; pPos[k*3+1] += pVel[k*3+1] * dt; pPos[k*3+2] += pVel[k*3+2] * dt;
    const f = Math.min(1, l * 2); pCol[k*3] = pBase[k*3] * f; pCol[k*3+1] = pBase[k*3+1] * f; pCol[k*3+2] = pBase[k*3+2] * f;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}

// ---------------------------------------------------------------- simpan data
const SAVE_KEY = 'surf_save2';
const defSave = () => ({ best: 0, coins: 0, keys: 3, boards: 2, mult: 1, sets: 0, missions: null, music: true, sfx: true });
let SV = defSave();
try { SV = Object.assign(defSave(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); SV.best = Math.max(SV.best, +(localStorage.getItem('surf_best') || 0)); } catch {}
const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SV)); } catch {} };

// ---------------------------------------------------------------- suara sintetis & musik
let ac = null;
const ensureAC = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch {} return ac; };
function tone(f, type, len, vol, t, f2) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + len);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + len + 0.02);
}
function sfx(kind) {
  if (!SV.sfx || !ensureAC()) return;
  try {
    const t = ac.currentTime;
    if (kind === 'swoosh') {
      const len = 0.16, b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter(); s.buffer = b; f.type = 'bandpass'; f.Q.value = 1; f.frequency.setValueAtTime(1500, t); f.frequency.exponentialRampToValueAtTime(500, t + len);
      g.gain.setValueAtTime(0.16, t); s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t);
    } else if (kind === 'coin') tone(880, 'sine', 0.1, 0.12, t, 1320);
    else if (kind === 'crash') tone(220, 'sawtooth', 0.4, 0.35, t, 40);
    else if (kind === 'hurt') tone(300, 'square', 0.18, 0.2, t, 90);
    else if (kind === 'land') tone(120, 'sine', 0.2, 0.12, t, 60);
    else if (kind === 'power') { tone(523, 'triangle', 0.12, 0.14, t); tone(659, 'triangle', 0.12, 0.14, t + 0.08); tone(784, 'triangle', 0.18, 0.14, t + 0.16); }
    else if (kind === 'board') tone(300, 'sine', 0.3, 0.16, t, 900);
    else if (kind === 'ui') tone(660, 'sine', 0.08, 0.1, t, 880);
  } catch {}
}
let mT = null, mStep = 0;
function musicTick() {
  if (!ac || ac.state !== 'running') return; const t = ac.currentTime + 0.02;
  const root = [110, 98, 87.3, 98][(mStep >> 3) & 3], sc = [0, 3, 7, 10, 12, 15, 12, 10], f = root * 2 * Math.pow(2, sc[mStep & 7] / 12);
  tone(f, 'triangle', 0.14, 0.04, t); if ((mStep & 1) === 0) tone(root, 'sine', 0.22, 0.07, t); mStep++;
}
function musicStart() { if (SV.music && !mT && ensureAC()) mT = setInterval(musicTick, 150); }
function musicStop() { if (mT) { clearInterval(mT); mT = null; } }

// ---------------------------------------------------------------- misi
const MT = {
  dist: { t: n => `Lari ${n} m dalam satu putaran`, b: 500, run: true },
  score: { t: n => `Capai skor ${n} dalam satu putaran`, b: 6000, run: true },
  coins: { t: n => `Kumpulkan ${n} koin`, b: 50 },
  jump: { t: n => `Lompat ${n} kali`, b: 10 },
  roll: { t: n => `Merunduk ${n} kali`, b: 8 },
  lane: { t: n => `Pindah jalur ${n} kali`, b: 25 },
  power: { t: n => `Ambil ${n} power-up`, b: 3 },
};
function newMissions() {
  return Object.keys(MT).sort(() => Math.random() - 0.5).slice(0, 3).map(k => {
    const step = MT[k].b >= 100 ? 50 : MT[k].b >= 40 ? 10 : 1;
    return { k, target: Math.max(step, Math.round(MT[k].b * (1 + 0.3 * SV.sets) / step) * step), p: 0, done: false };
  });
}
if (!Array.isArray(SV.missions) || SV.missions.length !== 3) SV.missions = newMissions();
function prog(k, n, abs = false) {
  let changed = false;
  for (const m of SV.missions) {
    if (m.k !== k || m.done) continue;
    const np = abs ? Math.max(m.p, n) : m.p + n; if (np === m.p) continue; m.p = Math.min(m.target, np); changed = true;
    if (m.p >= m.target) { m.done = true; toast('Misi selesai: ' + MT[k].t(m.target)); sfx('power'); }
  }
  if (changed && SV.missions.every(m => m.done)) {
    SV.mult = Math.min(30, SV.mult + 1); SV.sets++; SV.keys++; SV.boards++; toast(`Set misi selesai! Pengali x${SV.mult}, +1 kunci, +1 papan`, 3.2);
    SV.missions = newMissions(); save();
  }
}
const missionHTML = () => SV.missions.map(m => `<div class="${m.done ? 'd' : ''}">${m.done ? '✓ ' : '• '}${MT[m.k].t(m.target)} <b>(${Math.floor(m.p)}/${m.target})</b></div>`).join('');

// ---------------------------------------------------------------- model & animasi
const player = new THREE.Group(); player.rotation.y = Math.PI; scene.add(player);
let model, mixer, cur = null, pel1 = null, bind1 = null; const byKey = {}, actions = {};
const tmpV = new THREE.Vector3();
const findBone = (mesh, tail) => mesh.skeleton.bones.findIndex(b => b.name.replace(/[ _]/g, '').endsWith(tail));
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
    for (const t of c.tracks) { const node = model.getObjectByName(san(t.node)); if (!node) continue; tracks.push(t.path === 'position' ? new THREE.VectorKeyframeTrack(`${node.name}.position`, c.times, t.values) : new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, c.times, t.values)); }
    if (tracks.length) actions[c.name] = mixer.clipAction(new THREE.AnimationClip(c.name, c.times[c.times.length - 1], tracks));
  }
}
function play(name, { fade = 0.15, once = false, speed = 1 } = {}) {
  const a = actions[name]; if (!a) return null;
  a.enabled = true; a.setEffectiveWeight(1); a.setEffectiveTimeScale(speed);
  if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else { a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; }
  if (cur !== a) { a.reset(); a.play(); if (cur) cur.crossFadeTo(a, fade, false); cur = a; } else if (once) a.reset().play();
  return a;
}
const clipDur = n => actions[n] ? actions[n].getClip().duration : 1;
function applyLock() {
  if (!model) return; model.updateMatrixWorld(true);
  pel1.getWorldPosition(tmpV); model.worldToLocal(tmpV);
  for (const k of F1) if (byKey[k]) byKey[k].position.set(bind1.x - tmpV.x, 0, bind1.z - tmpV.z);
}

// ---------------------------------------------------------------- pengejar, papan, status
const chaser = new THREE.Group();
{ const mat = new THREE.MeshStandardMaterial({ color: 0x1a1030, emissive: 0xb45cff, emissiveIntensity: 1.6, roughness: 0.4 });
  chaser.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 1), mat));
  for (const x of [-0.2, 0.2]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); e.position.set(x, 0.1, -0.52); chaser.add(e); } }
chaser.visible = false; scene.add(chaser);
const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 1.8), new THREE.MeshStandardMaterial({ color: 0x0e2a3d, emissive: 0x38bdf8, emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.3 }));
boardMesh.position.y = 0.06; boardMesh.visible = false; player.add(boardMesh);

const S = { state: 'menu', stage: '', t: 0, dur: 0, speed: 0, dist: 0, score: 0, coins: 0, lane: 0, prevLane: 0, px: 0, py: 0, vy: 0, sliding: 0, slideTilt: 0, bufJump: 0, bufSlide: false, sinceRow: 0, gap: 30, sincePu: 0, nextPu: 60, time: 0, shake: 0, camx: 0,
  inv: 0, stumbleT: 0, board: 0, pu: { magnet: 0, x2: 0, sneak: 0, jet: 0 }, revives: 0, reviveLeft: 0, crashSpeed: 0, paused: false, chaserZ: 9, lastTap: 0 };
const queue = [];
const $$ = id => document.getElementById(id);
const panels = ['menu', 'pausep', 'revive', 'over'];
const showPanel = id => { for (const p of panels) $$(p).classList.toggle('on', p === id); };
let toastT = 0;
function toast(t, s = 2.2) { const el = $$('toast'); el.textContent = t; el.classList.add('on'); toastT = s; }
const reviveCost = () => 1 << Math.min(3, S.revives);
const canRevive = () => SV.keys >= reviveCost();

function resetRun() {
  Object.assign(S, { speed: 0, dist: 0, score: 0, coins: 0, lane: 0, prevLane: 0, px: 0, py: 0, vy: 0, sliding: 0, bufJump: 0, bufSlide: false, sinceRow: 0, gap: 40, sincePu: 0, nextPu: 60, inv: 0, stumbleT: 0, board: 0, revives: 0, chaserZ: 9, stage: '' });
  S.pu = { magnet: 0, x2: 0, sneak: 0, jet: 0 };
  for (const m of SV.missions) if (MT[m.k].run && !m.done) m.p = 0;
  clearWorld();
}
function startIntro(clip) {
  resetRun(); S.state = 'intro'; S.t = 0; S.dur = clipDur(clip); S.paused = false; showPanel(null); play(clip, { once: true, fade: 0.05 });
}
function startRun() { S.state = 'run'; S.speed = CFG.v0; musicStart(); }
function showMenu() {
  musicStop(); resetRun(); S.state = 'menu'; S.paused = false; play('fight_idle', { fade: 0.2 });
  $$('m-best').textContent = 'Skor terbaik ' + SV.best; $$('m-wallet').textContent = `● ${SV.coins}  ·  Kunci ${SV.keys}  ·  Papan ${SV.boards}  ·  Pengali x${SV.mult}`;
  $$('mlist').innerHTML = missionHTML(); $$('m-music').textContent = 'Musik: ' + (SV.music ? 'ON' : 'OFF'); $$('m-sfx').textContent = 'Suara: ' + (SV.sfx ? 'ON' : 'OFF'); showPanel('menu');
}
function pause(on) {
  if (S.state !== 'run' && !S.paused) return; S.paused = on; showPanel(on ? 'pausep' : null); if (on) musicStop(); else musicStart();
}
function stumble() {
  S.stumbleT = CFG.stumbleWin; S.inv = 0.8; S.shake = 0.35; S.speed = Math.max(CFG.v0, S.speed * 0.8); sfx('hurt'); toast('Hampir! Hati-hati, pengejar mendekat', 1.6);
  const h = $$('hurt'); h.style.transition = 'none'; h.style.opacity = 1; requestAnimationFrame(() => { h.style.transition = 'opacity .5s'; h.style.opacity = 0; });
}
function breakBoard() { S.board = 0; S.inv = 1.6; S.shake = 0.25; sfx('crash'); burst(tmpV.set(S.px, 0.4, 0), 0x38bdf8, 30, 5, 3); toast('Papan melindungimu!', 1.4); }
function crash(why) {
  S.state = 'dead'; S.stage = 'anim'; S.t = 0; S.crashSpeed = S.speed; S.shake = 0.5; S.board = 0; S.pu.jet = 0; S.py = 0; S.vy = 0; musicStop();
  play('dead', { once: true, fade: 0.08 }); sfx('crash'); burst(tmpV.set(S.px, 1, 0), 0xc084fc, 40, 6, 4);
}
function showRevive() { $$('rev-cost').textContent = `Biaya ${reviveCost()} kunci (kamu punya ${SV.keys})`; showPanel('revive'); }
function revive() {
  if (!canRevive()) return; SV.keys -= reviveCost(); S.revives++; save();
  for (let i = obs.length - 1; i >= 0; i--) if (obs[i].z > -45) { scene.remove(obs[i].g); obs.splice(i, 1); }
  S.state = 'run'; S.stage = ''; S.inv = 2.5; S.stumbleT = 0; S.py = 0; S.vy = 0; S.speed = Math.max(CFG.v0, S.crashSpeed * 0.85); S.chaserZ = 9;
  showPanel(null); musicStart(); sfx('power'); toast('Lanjut!', 1.2);
}
function finish() {
  if (S.stage === 'over') return;
  S.stage = 'over'; if (S.score > SV.best) SV.best = Math.floor(S.score); save();
  $$('o-score').textContent = Math.floor(S.score); $$('o-line').textContent = `${Math.floor(S.dist)} m · ● ${S.coins}`;
  $$('o-best').textContent = 'Terbaik ' + SV.best; $$('olist').innerHTML = missionHTML(); updOverButtons(); showPanel('over');
}
function updOverButtons() {
  $$('o-wallet').textContent = `● ${SV.coins}  ·  Kunci ${SV.keys}  ·  Papan ${SV.boards}  ·  Pengali x${SV.mult}`;
  $$('o-key').toggleAttribute('disabled', SV.coins < 200); $$('o-board').toggleAttribute('disabled', SV.coins < 150);
}
function collectPickup(p) {
  S.pu[p.type] = CFG.dur[p.type]; sfx('power'); toast(PU[p.type].n, 1.2); prog('power', 1); burst(p.g.position, PU[p.type].c, 18, 3, 3);
  if (p.type === 'jet') { jetTrail(); S.sliding = 0; }
}

function act(k) {
  if (S.paused || S.state === 'menu') return;
  if (S.state !== 'run') return;
  if (k === 'left' && S.lane > -1) { S.prevLane = S.lane; S.lane--; prog('lane', 1); }
  else if (k === 'right' && S.lane < 1) { S.prevLane = S.lane; S.lane++; prog('lane', 1); }
  else if (k === 'jump') {
    if (S.pu.jet > 0) return;
    if (S.py <= 0.001) { S.vy = CFG.jumpV * (S.pu.sneak > 0 ? 1.45 : 1); S.sliding = 0; sfx('swoosh'); prog('jump', 1); burst(tmpV.set(S.px, 0.1, 0), 0x8b5cf6, 8, 2, 1); } else S.bufJump = 0.15;
  } else if (k === 'slide') {
    if (S.pu.jet > 0) return;
    if (S.py > 0.001) { S.vy = Math.min(S.vy, -16); S.bufSlide = true; } else { S.sliding = CFG.slideT; sfx('swoosh'); prog('roll', 1); }
  } else if (k === 'board') {
    if (S.board <= 0 && SV.boards > 0) { SV.boards--; S.board = CFG.boardDur; sfx('board'); save(); toast('Papan aktif', 1.2); }
  }
}

function sim(dt) {
  S.time += dt;
  const running = S.state === 'run';
  if (S.state === 'intro') { S.t += dt; if (S.t >= S.dur) startRun(); }
  else if (S.state === 'dead') {
    S.t += dt; S.speed *= Math.exp(-6 * dt);
    if (S.stage === 'anim' && S.t > 0.9) { if (canRevive()) { S.stage = 'revive'; S.reviveLeft = CFG.reviveSecs; showRevive(); } else finish(); }
    else if (S.stage === 'revive') { S.reviveLeft -= dt; $$('rev-n').textContent = Math.max(0, Math.ceil(S.reviveLeft)); if (S.reviveLeft <= 0) finish(); }
  } else if (running) {
    S.speed = Math.min(CFG.vmax, S.speed + CFG.accel * dt);
    for (const k in S.pu) { if (S.pu[k] > 0) { S.pu[k] = Math.max(0, S.pu[k] - dt); if (S.pu[k] === 0 && k === 'jet') { S.inv = 2.0; toast('Jetpack habis', 1); } } }
    S.board = Math.max(0, S.board - dt); S.inv = Math.max(0, S.inv - dt); S.stumbleT = Math.max(0, S.stumbleT - dt);
  }
  const dz = S.speed * dt;
  if (running) { S.dist += dz; S.sincePu += dz; S.score += dz * CFG.scorePerM * SV.mult * (S.pu.x2 > 0 ? 2 : 1); prog('dist', S.dist, true); prog('score', S.score, true); }
  // dunia bergerak ke arah kamera
  for (const b of buildings) { b.position.z += dz; if (b.position.z > 16) placeBuilding(b, b.position.z - 115); }
  for (const a of arches) { a.position.z += dz; if (a.position.z > 14) a.position.z -= 120; }
  trackTex.offset.y += dz / PERIOD;
  for (let i = obs.length - 1; i >= 0; i--) { const o = obs[i]; o.z += dz; o.g.position.z = o.z; if (o.z - o.hd > 14) { scene.remove(o.g); obs.splice(i, 1); } }
  for (let i = pickups.length - 1; i >= 0; i--) { const p = pickups[i]; p.z += dz; p.g.position.z = p.z; p.g.rotation.y += dt * 3; p.g.position.y = 1.2 + Math.sin(S.time * 4 + p.z) * 0.12; if (p.z > 14) { scene.remove(p.g); pickups.splice(i, 1); } }
  const mag = S.pu.magnet > 0 && running;
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i]; c.z += dz;
    if (mag && c.z > -16 && c.z < 2) { const k = Math.min(1, dt * 9); c.x += (S.px - c.x) * k; c.y += (S.py + 0.95 - c.y) * k; }
    c.m.position.set(c.x, c.y, c.z); c.m.rotation.y += dt * 4; if (c.z > 14) { scene.remove(c.m); coins.splice(i, 1); }
  }
  if (running) { S.sinceRow += dz; if (S.sinceRow >= S.gap) { S.sinceRow = 0; S.gap = S.speed * 0.95 + 10; spawnRow(); } }
  // pemain: jalur, lompat, merunduk, jetpack
  if (running || S.state === 'dead') {
    const dx = S.lane * CFG.LW - S.px, mx = CFG.LW / 0.11 * dt; S.px += Math.max(-mx, Math.min(mx, dx));
  }
  if (running) {
    if (S.pu.jet > 0) { S.vy = 0; S.py += (4.2 - S.py) * Math.min(1, dt * 3.5); burst(tmpV.set(S.px, S.py + 0.3, 0.4), 0xfb923c, 1, 1.5, 0.5); }
    else if (S.py > 0 || S.vy > 0) {
      S.vy -= CFG.gravity * dt; S.py += S.vy * dt;
      if (S.py <= 0) { S.py = 0; S.vy = 0; sfx('land'); burst(tmpV.set(S.px, 0.1, 0), 0x8b5cf6, 8, 2, 1); if (S.bufJump > 0) { S.vy = CFG.jumpV * (S.pu.sneak > 0 ? 1.45 : 1); S.bufJump = 0; } if (S.bufSlide) { S.sliding = CFG.slideT; S.bufSlide = false; } }
    }
    S.bufJump = Math.max(0, S.bufJump - dt); S.sliding = Math.max(0, S.sliding - dt);
  }
  player.position.set(S.px, S.py, 0);
  // tabrakan, koin, power-up
  if (running) {
    const top = S.py + (S.sliding > 0 ? CFG.slideH : CFG.standH);
    for (const o of obs) {
      if (o.hit) continue; const dxo = Math.abs(o.x - S.px);
      if (Math.abs(o.z) > o.hd + 0.35 || dxo > o.hw + 0.2) continue;
      const hit = o.type === 'block' ? S.py < 2.8 : o.type === 'low' ? S.py < 0.82 : top > 1.5;
      if (!hit || S.pu.jet > 0 || S.inv > 0) continue;
      const head = o.type === 'block' && dxo < 0.75;
      if (S.board > 0) { if (o.type !== 'block') o.hit = true; breakBoard(); continue; }
      S.cause = { type: o.type, head, stumbled: S.stumbleT > 0, py: +S.py.toFixed(2) };
      if (head || S.stumbleT > 0) { crash(); break; }
      if (o.type !== 'block') o.hit = true; else S.lane = S.prevLane;
      stumble();
    }
  }
  if (running) {
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (Math.abs(c.z) < 0.9 && Math.abs(c.x - S.px) < 0.95 && Math.abs(c.y - (S.py + 0.95)) < 1.05) { burst(c.m.position, 0xffd166, 6, 2.5, 2); scene.remove(c.m); coins.splice(i, 1); S.coins++; SV.coins++; prog('coins', 1); sfx('coin'); }
    }
    for (let i = pickups.length - 1; i >= 0; i--) { const p = pickups[i]; if (Math.abs(p.z) < 0.9 && Math.abs(p.x - S.px) < 0.95 && Math.abs(1.2 - (S.py + 0.95)) < 1.3) { collectPickup(p); scene.remove(p.g); pickups.splice(i, 1); } }
  }
  S.shake = Math.max(0, S.shake - dt);
  updateParticles(dt);
}

function animate(dt) {
  if (S.state === 'run') {
    const ts = 1.25 + 0.55 * (S.speed - CFG.v0) / (CFG.vmax - CFG.v0);
    if (S.py > 0.001) play('fastrun', { fade: 0.1, speed: 0.35 }); else if (S.sliding > 0) play('fight_idle', { fade: 0.1 }); else play('fastrun', { fade: 0.12, speed: ts });
  }
  const tgt = (S.state === 'run' && S.sliding > 0) ? 1 : 0; S.slideTilt += (tgt - S.slideTilt) * Math.min(1, dt * 16);
  model.rotation.x = -1.15 * S.slideTilt; model.position.y = 0.3 * S.slideTilt + (S.board > 0 ? 0.14 : 0);
  const vx = (S.lane * CFG.LW - S.px); player.rotation.y = Math.PI - Math.max(-0.45, Math.min(0.45, vx * 0.22));
  model.visible = !(S.state === 'run' && S.inv > 0 && Math.floor(S.time * 16) % 2 === 0);
  boardMesh.visible = S.board > 0 && (S.board > 3 || Math.floor(S.time * 8) % 2 === 0);
  // pengejar: mendekat setelah tersandung, menerkam saat tertangkap
  const wantZ = S.state === 'dead' ? 0.6 : S.stumbleT > 0 ? 2.6 : 9;
  S.chaserZ += (wantZ - S.chaserZ) * Math.min(1, dt * (S.state === 'dead' ? 10 : 3));
  chaser.visible = S.chaserZ < 6.8 && S.state !== 'menu'; chaser.position.set(S.px, 0.9 + Math.sin(S.time * 6) * 0.12 + S.py * 0.5, S.chaserZ); chaser.rotation.y += dt * 2; chaser.rotation.x = Math.sin(S.time * 5) * 0.2;
  if (chaser.visible && S.state === 'run') burst(tmpV.set(S.px, 0.7, S.chaserZ), 0xb45cff, 1, 1, 0.5);
  S.camx += (S.px * 0.6 - S.camx) * Math.min(1, dt * 8);
  const sh = S.shake > 0 ? (Math.random() - 0.5) * S.shake * 0.5 : 0;
  camera.position.set(S.camx + sh, 3.1 + S.py * 0.35, 6.2); camera.lookAt(S.camx * 0.6, 1.6 + S.py * 0.2, -8);
  sun.position.set(S.px + 5, 14, 6); sun.target.position.set(S.px, 0, -6); rim.position.set(S.px - 1.5, 2.6, 2);
}

// ---------------------------------------------------------------- HUD
const chipEls = {}; for (const k in PU) { const el = document.createElement('div'); el.className = 'chip'; el.style.background = '#' + PU[k].c.toString(16).padStart(6, '0'); $$('chips').appendChild(el); chipEls[k] = el; }
const boardChip = document.createElement('div'); boardChip.className = 'chip'; boardChip.style.background = '#7dd3fc'; $$('chips').appendChild(boardChip);
let lastMM = '';
function hud(dt) {
  $$('score').textContent = Math.floor(S.score); $$('coin').textContent = '● ' + SV.coins; $$('mult').textContent = 'x' + (SV.mult * (S.pu.x2 > 0 ? 2 : 1)); $$('keys').textContent = 'Kunci ' + SV.keys;
  for (const k in PU) { const v = S.pu[k], el = chipEls[k]; el.style.display = v > 0 ? 'block' : 'none'; if (v > 0) el.textContent = PU[k].n + ' ' + Math.ceil(v) + 'd'; }
  boardChip.style.display = S.board > 0 ? 'block' : 'none'; if (S.board > 0) boardChip.textContent = 'PAPAN ' + Math.ceil(S.board) + 'd';
  const bb = $$('boardBtn'); $$('bn').textContent = 'x' + SV.boards; bb.classList.toggle('off', SV.boards <= 0 || S.board > 0 || S.state !== 'run');
  const mm = missionHTML(); if (mm !== lastMM) { $$('mm').innerHTML = mm; lastMM = mm; }
  if (toastT > 0 && (toastT -= dt) <= 0) $$('toast').classList.remove('on');
  $$('hint').style.opacity = (S.state === 'run' && S.dist < 40) || S.state === 'intro' ? 1 : 0;
  $$('hud').style.display = S.state === 'menu' ? 'none' : 'block';
}
function tick(dt) {
  if (!mixer) return;
  if (S.paused) { hud(0); animate(0); return; }
  while (queue.length) act(queue.shift());
  const n = Math.max(1, Math.ceil(dt / 0.016)); for (let i = 0; i < n; i++) sim(dt / n);
  mixer.update(dt); applyLock(); animate(dt); hud(dt);
}

// ---------------------------------------------------------------- input & tombol
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { pause(!S.paused); e.preventDefault(); return; }
  if (S.state === 'menu' || S.paused) { if (e.code === 'Enter') { if (S.paused) pause(false); else $$('m-play').click(); } return; }
  const m = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'slide', KeyS: 'slide', KeyH: 'board' }[e.code];
  if (e.code === 'Enter' && S.state === 'dead') { if (S.stage === 'over') $$('o-again').click(); else if (S.stage === 'revive') $$('rev-yes').click(); return; }
  if (m) { queue.push(m); e.preventDefault(); }
});
let sw = null;
canvas.addEventListener('pointerdown', e => { sw = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false, t: performance.now() }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!sw || e.pointerId !== sw.id) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (Math.hypot(dx, dy) < 28) return; sw.fired = true; sw.x = e.clientX; sw.y = e.clientY;
  queue.push(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'jump' : 'slide'));
});
const endSw = e => {
  if (sw && e.pointerId === sw.id) { const now = performance.now(); if (!sw.fired && now - sw.t < 250) { if (now - S.lastTap < 320) { queue.push('board'); S.lastTap = 0; } else S.lastTap = now; } sw = null; }
};
canvas.addEventListener('pointerup', endSw); canvas.addEventListener('pointercancel', endSw);
$$('boardBtn').addEventListener('pointerdown', e => { e.preventDefault(); queue.push('board'); });
$$('pause').addEventListener('pointerdown', e => { e.preventDefault(); pause(true); });
$$('m-play').addEventListener('click', () => { ensureAC(); sfx('ui'); startIntro('birth'); });
$$('m-music').addEventListener('click', () => { SV.music = !SV.music; if (!SV.music) musicStop(); save(); showMenu(); });
$$('m-sfx').addEventListener('click', () => { SV.sfx = !SV.sfx; save(); showMenu(); });
$$('p-resume').addEventListener('click', () => pause(false));
$$('p-restart').addEventListener('click', () => { musicStop(); startIntro('landing'); });
$$('p-menu').addEventListener('click', showMenu);
$$('rev-yes').addEventListener('click', revive);
$$('rev-no').addEventListener('click', finish);
$$('o-again').addEventListener('click', () => startIntro('landing'));
$$('o-menu').addEventListener('click', showMenu);
$$('o-key').addEventListener('click', () => { if (SV.coins >= 200) { SV.coins -= 200; SV.keys++; save(); sfx('power'); updOverButtons(); } });
$$('o-board').addEventListener('click', () => { if (SV.coins >= 150) { SV.coins -= 150; SV.boards++; save(); sfx('power'); updOverButtons(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && S.state === 'run') pause(true); });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// ---------------------------------------------------------------- mulai
async function init() {
  const lm = $('#lmsg'), bar = $('#bar i');
  const gltf = await loadGLB('/models/selena_zenith_hd.glb', (g, t) => { bar.style.width = (t ? g / t * 85 : 40) + '%'; lm.textContent = `Memuat model ${(g / 1e6).toFixed(1)}${t ? ' / ' + (t / 1e6).toFixed(1) : ''} MB`; });
  lm.textContent = 'Menyiapkan rig & animasi…'; bar.style.width = '92%';
  model = gltf.scene; player.add(model);
  model.traverse(o => {
    if (!o.isSkinnedMesh) return; const k = KEYS.find(k => o.name.includes(k)); if (!k) return;
    byKey[k] = o; o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; o.bindMode = THREE.DetachedBindMode; o.bindMatrixInverse.copy(o.bindMatrix).invert();
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) { m.envMapIntensity = 1.0; if (m.transparent && !m.alphaTest) m.depthWrite = false; if (m.map) m.map.anisotropy = 8; }
    if (k === 'qunzi01') o.renderOrder = 3; if (k === 'hair01') o.renderOrder = 2;
  });
  for (const k of F2) if (byKey[k]) byKey[k].visible = false;
  const b1 = byKey.body01, i1 = findBone(b1, 'Bip001Pelvis'); pel1 = b1.skeleton.bones[i1];
  bind1 = new THREE.Vector3().setFromMatrixPosition(b1.skeleton.boneInverses[i1].clone().invert());
  mixer = new THREE.AnimationMixer(model);
  buildClips(await fetch('/data/clips_hd.json', { cache: 'no-cache' }).then(r => r.json()));
  play('fight_idle', { fade: 0 }); applyLock(); animate(0);
  bar.style.width = '100%'; lm.textContent = 'Siap'; $('#loading').classList.add('done'); showMenu();
}
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!window.__manual) tick(dt);
  if (!window.__norender) composer.render();
}
window.__game = { S, SV, obs, coins, pickups, CFG, queue, step: tick, actions, act, addObs, addPickup, addCoin, showMenu, pause, revive, finish, get model() { return model; }, THREE };
init().catch(e => { $('#lmsg').textContent = 'Gagal memuat: ' + e.message; console.error(e); });
requestAnimationFrame(loop);
