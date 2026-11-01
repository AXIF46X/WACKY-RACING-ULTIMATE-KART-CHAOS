// ============================================================================
// Procedural 3D builders — karts, drivers, tracks, props.
// Everything is built from Three.js primitives at runtime (zero asset files)
// and is safe to run headless in Node (used by scripts/smoke.ts).
// ============================================================================

import * as THREE from "three";
import { trackById, type TrackDef, type Vehicle, type Cosmetic, WHEELS } from "./data";

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function std(color: number | string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, metalness: 0.08, ...opts });
}

export function mesh(
  geo: THREE.BufferGeometry,
  color: number | string,
  x = 0, y = 0, z = 0,
  opts: Partial<THREE.MeshStandardMaterialParameters> = {},
): THREE.Mesh {
  const m = new THREE.Mesh(geo, std(color, opts));
  m.position.set(x, y, z);
  return m;
}

const BOX = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const SPH = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const CYL = (rt: number, rb: number, h: number, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const CONE = (r: number, h: number, s = 10) => new THREE.ConeGeometry(r, h, s);

// ---------------------------------------------------------------------------
// Track spline sampling (closed Catmull-Rom)
// ---------------------------------------------------------------------------

export const TRACK_SAMPLES = 700;

export interface TrackSample {
  pos: THREE.Vector3;
  tan: THREE.Vector3;
  lat: THREE.Vector3;
  /** normalized position 0..1 */
  s: number;
}

/** elevation (y) of a track at normalized position s, from hills + ramps */
export function trackElevation(def: TrackDef, s: number): number {
  let y = 0;
  const wrap = (d: number) => (d > 0.5 ? d - 1 : d < -0.5 ? d + 1 : d);
  for (const hill of def.hills ?? []) {
    const d = wrap(s - hill.at) / Math.max(0.005, hill.w);
    y += hill.h * Math.exp(-d * d);
  }
  for (const ramp of def.ramps ?? []) {
    const ds = wrap(s - ramp.at);
    const u = ds / Math.max(0.005, ramp.len);
    if (u >= 0 && u <= 1) y += ramp.h * Math.pow(Math.sin(Math.PI * u), 2);
  }
  return y;
}

export function sampleTrack(def: TrackDef, n = TRACK_SAMPLES): TrackSample[] {
  const pts = def.points;
  const len = pts.length;
  const at = (i: number) => pts[((i % len) + len) % len];
  const out: TrackSample[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * len;
    const i0 = Math.floor(t) % len;
    const i1 = (i0 + 1) % len;
    const im = (i0 - 1 + len) % len;
    const i2 = (i0 + 2) % len;
    const u = t - Math.floor(t);
    const u2 = u * u, u3 = u2 * u;
    const cr = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
    const x = cr(at(im)[0], at(i0)[0], at(i1)[0], at(i2)[0]);
    const z = cr(at(im)[1], at(i0)[1], at(i1)[1], at(i2)[1]);
    const s = i / n;
    out.push({
      pos: new THREE.Vector3(x, trackElevation(def, s), z),
      tan: new THREE.Vector3(0, 0, 1),
      lat: new THREE.Vector3(1, 0, 0),
      s,
    });
  }
  // tangents + laterals from finite differences (closed loop)
  for (let i = 0; i < n; i++) {
    const p = out[(i + 1) % n].pos;
    const m = out[(i - 1 + n) % n].pos;
    const tan = new THREE.Vector3().subVectors(p, m);
    if (tan.lengthSq() < 1e-9) tan.set(0, 0, 1);
    tan.normalize();
    const lat = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    out[i].tan.copy(tan);
    out[i].lat.copy(lat);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Track building
// ---------------------------------------------------------------------------

export interface Obstacle {
  mesh: THREE.Object3D;
  base: THREE.Vector3;
  axis: "x" | "z";
  range: number;
  speed: number;
  phase: number;
}

export interface BuiltTrack {
  def: TrackDef;
  group: THREE.Group;
  samples: TrackSample[];
  length: number;
  width: number; // half-width
  pickupSpots: THREE.Vector3[];
  coinSpots: THREE.Vector3[];
  obstacles: Obstacle[];
  itemBoxes: THREE.Mesh[];
  coins: THREE.Mesh[];
}

/** ribbon strip along the samples between lateral offsets a..b */
function ribbon(samples: TrackSample[], halfW: number, offA: number, offB: number, yOff: number, colorA: number | string, colorB: number | string): THREE.Mesh {
  const n = samples.length;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const cA = new THREE.Color(colorA);
  const cB = new THREE.Color(colorB);
  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const a = s.pos.clone().addScaledVector(s.lat, offA); a.y += yOff;
    const b = s.pos.clone().addScaledVector(s.lat, offB); b.y += yOff;
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const c = i % 2 === 0 ? cA : cB;
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    if (i < n) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
  return m;
}

function sceneryFor(decor: TrackDef["theme"]["decor"], rng: () => number, accent: number): THREE.Mesh {
  const g = new THREE.Group();
  const pick = (arr: THREE.Mesh[]) => g.add(arr[Math.floor(rng() * arr.length)]);
  switch (decor) {
    case "candy":
      pick([
        (() => { const m = mesh(SPH(1.6, 12, 10), 0xff5ca8); m.add(mesh(CYL(0.12, 0.12, 3), 0xfff8ef, 0, -2.2, 0)); return m; })(),
        mesh(CONE(1.4, 3.2, 8), 0xffd23f),
        mesh(CYL(0.9, 1.1, 2.6, 8), 0x2dd4c8),
        mesh(SPH(1.2, 10, 8), 0x8b5cf6),
      ]);
      break;
    case "toilet":
      pick([
        (() => { const m = mesh(CYL(1.0, 1.2, 1.6, 10), 0xffffff); m.add(mesh(BOX(1.6, 1.2, 0.8), 0xf0f4ff, 0, 1.4, -0.6)); return m; })(),
        (() => { const m = mesh(SPH(1.1, 10, 8), 0xffd23f); const beak = mesh(CONE(0.5, 0.9, 8), 0xff7f2a, 0, 0.4, 1.0); beak.rotation.x = Math.PI / 2; m.add(beak); return m; })(),
        mesh(CYL(0.8, 0.8, 3.4, 8), 0xe8f2ff),
      ]);
      break;
    case "jungle":
      pick([
        (() => { const m = mesh(CYL(0.3, 0.4, 2.4), 0x7a5230); m.add(mesh(CONE(1.8, 4, 8), 0x2f9e4f, 0, 3.2, 0)); return m; })(),
        mesh(SPH(1.4, 8, 6), 0x3fae62),
        mesh(CONE(1.2, 2.6, 7), 0x278a44),
      ]);
      break;
    case "toy":
      pick([
        mesh(BOX(2.4, 2.4, 2.4), [0xff4d6d, 0xffd23f, 0x2dd4c8, 0x8b5cf6][Math.floor(rng() * 4)]),
        mesh(SPH(1.5, 12, 10), 0xff7f2a),
        mesh(CYL(0.5, 0.5, 3, 8), 0x5b8dd9),
      ]);
      break;
    case "sky":
      pick([
        (() => { const m = mesh(SPH(1.8, 10, 8), 0xffffff); m.add(mesh(SPH(1.3, 8, 6), 0xffffff, 1.4, 0.4, 0)); m.add(mesh(SPH(1.2, 8, 6), 0xffffff, -1.3, 0.3, 0.2)); return m; })(),
        mesh(CONE(1.6, 3, 8), 0xfff8ef),
      ]);
      break;
    case "volcano":
      pick([
        mesh(new THREE.DodecahedronGeometry(1.6), 0x3a2c34),
        (() => { const m = mesh(CYL(1.8, 2.2, 0.5, 10), 0xff4d00, 0, 0, 0, { emissive: 0xff3300, emissiveIntensity: 0.9 }); return m; })(),
        mesh(CONE(2.0, 4.4, 7), 0x4a3440),
      ]);
      break;
    case "ice":
      pick([
        mesh(CONE(1.8, 5, 6), 0xdff4ff),
        (() => { const m = mesh(SPH(1.0, 8, 6), 0xffffff); m.add(mesh(SPH(0.7, 8, 6), 0xffffff, 0, 1.2, 0)); return m; })(),
        mesh(BOX(2.2, 1.2, 2.2), 0xbfe8ff),
      ]);
      break;
    case "alien":
    default:
      pick([
        mesh(new THREE.OctahedronGeometry(1.8), accent, 0, 0, 0, { emissive: accent, emissiveIntensity: 0.55 }),
        mesh(CYL(0.25, 0.25, 4, 6), 0xb6f34d, 0, 0, 0, { emissive: 0xb6f34d, emissiveIntensity: 0.4 }),
        mesh(SPH(1.3, 8, 6), 0x8b5cf6, 0, 0, 0, { emissive: 0x8b5cf6, emissiveIntensity: 0.35 }),
      ]);
      break;
  }
  g.scale.setScalar(0.8 + rng() * 1.4);
  g.rotation.y = rng() * Math.PI * 2;
  // first child is the visible prop
  return g.children[0] as THREE.Mesh;
}

export function buildTrack(def: TrackDef): BuiltTrack {
  const samples = sampleTrack(def);
  const n = samples.length;
  const group = new THREE.Group();
  group.name = `track:${def.id}`;

  // length
  let length = 0;
  for (let i = 0; i < n; i++) length += samples[i].pos.distanceTo(samples[(i + 1) % n].pos);

  const halfW = def.width;

  // ground disc (big, so you never see the void)
  const ground = mesh(new THREE.CircleGeometry(420, 40), def.theme.ground, 0, -0.35, 0);
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // road + curbs + edge lines
  group.add(ribbon(samples, halfW, -halfW, halfW, 0.05, def.theme.road, def.theme.road));
  group.add(ribbon(samples, halfW, -halfW - 1.1, -halfW, 0.07, def.theme.curbA, def.theme.curbB));
  group.add(ribbon(samples, halfW, halfW, halfW + 1.1, 0.07, def.theme.curbB, def.theme.curbA));
  group.add(ribbon(samples, halfW, -halfW + 0.25, -halfW + 0.55, 0.09, 0xfff8ef, 0xfff8ef));
  group.add(ribbon(samples, halfW, halfW - 0.55, halfW - 0.25, 0.09, 0xfff8ef, 0xfff8ef));

  // start / finish line: checker of small tiles across the road at s=0
  const start = samples[0];
  const tiles = new THREE.Group();
  for (let ix = 0; ix < 8; ix++) {
    for (let iz = 0; iz < 2; iz++) {
      const t = mesh(BOX(halfW * 2 / 8, 0.06, 0.9), (ix + iz) % 2 === 0 ? 0x16181d : 0xf5f5f5);
      const off = -halfW + (ix + 0.5) * (halfW * 2 / 8);
      const p = start.pos.clone().addScaledVector(start.lat, off).addScaledVector(start.tan, iz * 0.9 - 0.45);
      p.y += 0.12;
      t.position.copy(p);
      t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0));
      // align tile to track direction
      t.rotation.y = Math.atan2(start.tan.x, start.tan.z);
      tiles.add(t);
    }
  }
  group.add(tiles);

  // scenery (deterministic)
  const rng = mulberry32(hashStr(def.id));
  const sceneryCount = 130;
  for (let i = 0; i < sceneryCount; i++) {
    const s = samples[Math.floor(rng() * n)];
    const side = rng() > 0.5 ? 1 : -1;
    const off = halfW + 5 + rng() * 34;
    const p = s.pos.clone().addScaledVector(s.lat, side * off);
    // keep scenery roughly on the terrain height
    p.y = trackElevation(def, s.s) - 0.2;
    const prop = sceneryFor(def.theme.decor, rng, def.theme.accent);
    prop.position.copy(p);
    group.add(prop);
  }

  // moving obstacles (some tracks)
  const obstacles: Obstacle[] = [];
  if (def.moving) {
    for (let k = 0; k < 3; k++) {
      const sIdx = Math.floor(n * (0.25 + k * 0.25));
      const s = samples[sIdx];
      const rock = mesh(new THREE.DodecahedronGeometry(2.2), def.theme.decor === "volcano" ? 0xff4d00 : def.theme.accent, 0, 1.6, 0, def.theme.decor === "volcano" ? { emissive: 0xff3300, emissiveIntensity: 0.7 } : {});
      const base = s.pos.clone().addScaledVector(s.lat, 0);
      base.y += 0;
      rock.position.copy(base);
      group.add(rock);
      obstacles.push({ mesh: rock, base, axis: rng() > 0.5 ? "x" : "z", range: halfW * 0.8, speed: 0.6 + rng() * 0.8, phase: rng() * Math.PI * 2 });
    }
  } else {
    // a couple of static cones on the apron
    for (let k = 0; k < 4; k++) {
      const sIdx = Math.floor(n * (0.15 + k * 0.2));
      const s = samples[sIdx];
      const cone = mesh(CONE(0.9, 2.0, 8), 0xff7f2a);
      const base = s.pos.clone().addScaledVector(s.lat, (k % 2 === 0 ? 1 : -1) * (halfW + 2.5));
      cone.position.copy(base).add(new THREE.Vector3(0, 1, 0));
      group.add(cone);
      obstacles.push({ mesh: cone, base, axis: "x", range: 0, speed: 0, phase: 0 });
    }
  }

  // item box spots (rows of 3) + meshes
  const pickupSpots: THREE.Vector3[] = [];
  const itemBoxes: THREE.Mesh[] = [];
  for (const frac of [0.18, 0.42, 0.66, 0.88]) {
    const s = samples[Math.floor(frac * n)];
    for (const off of [-3, 0, 3]) {
      const p = s.pos.clone().addScaledVector(s.lat, off);
      p.y += 1.0;
      pickupSpots.push(p);
      const b = buildItemBox();
      b.position.copy(p);
      group.add(b);
      itemBoxes.push(b as THREE.Mesh);
    }
  }

  // coin spots (arcs)
  const coinSpots: THREE.Vector3[] = [];
  const coins: THREE.Mesh[] = [];
  const coinRng = mulberry32(hashStr(def.id + ":coins"));
  for (let a = 0; a < 7; a++) {
    const frac = 0.08 + a * 0.13 + coinRng() * 0.03;
    const s = samples[Math.floor(frac * n)];
    for (let c = 0; c < 6; c++) {
      const off = -4.5 + c * 1.8;
      const p = s.pos.clone().addScaledVector(s.lat, off);
      const s2 = samples[Math.min(n - 1, Math.floor(frac * n) + 2)];
      p.addScaledVector(s2.tan, (c - 2.5) * 0.7);
      p.y += 0.9;
      coinSpots.push(p);
      const coin = buildCoin();
      coin.position.copy(p);
      group.add(coin);
      coins.push(coin);
    }
  }

  return { def, group, samples, length, width: halfW, pickupSpots, coinSpots, obstacles, itemBoxes, coins };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Props: item box, coin, banana, chicken
// ---------------------------------------------------------------------------

export function buildItemBox(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x2dd4c8, flatShading: true, emissive: 0x2dd4c8, emissiveIntensity: 0.45, transparent: true, opacity: 0.9,
  }));
  const wire = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshBasicMaterial({ color: 0x16181d, wireframe: true }));
  m.add(wire);
  return m;
}

export function buildCoin(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.12, 14),
    new THREE.MeshStandardMaterial({ color: 0xffd23f, flatShading: true, emissive: 0xa87b00, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.3 }),
  );
}

export function buildBanana(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd23f, flatShading: true, roughness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mat);
    const a = (i / 3 - 0.5) * 1.6;
    seg.position.set(Math.sin(a) * 0.9, 0.25 + Math.cos(a) * 0.18, 0);
    seg.scale.set(1, 0.7, 1.4);
    g.add(seg);
  }
  return g;
}

export function buildChicken(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xfff8ef, flatShading: true });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), white);
  body.scale.set(1, 0.9, 1.2);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), white);
  head.position.set(0, 0.5, 0.55);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0xff7f2a, flatShading: true }));
  beak.position.set(0, 0.48, 0.95);
  beak.rotation.x = Math.PI / 2;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0xff4d6d, flatShading: true }));
  tail.position.set(0, 0.35, -0.7);
  tail.rotation.x = -Math.PI / 2.4;
  g.add(body, head, beak, tail);
  return g;
}

// ---------------------------------------------------------------------------
// Karts (one shape per vehicle)
// ---------------------------------------------------------------------------

export interface BuiltKart {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  body: THREE.Group;
}

function wheelGeo(style: string): THREE.BufferGeometry {
  const base = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12);
  base.rotateZ(Math.PI / 2);
  if (style === "offroad") { const g = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12); g.rotateZ(Math.PI / 2); return g; }
  if (style === "slick") { const g = new THREE.CylinderGeometry(0.44, 0.44, 0.22, 12); g.rotateZ(Math.PI / 2); return g; }
  return base;
}

function wheelColor(style: string): number {
  switch (style) {
    case "chrome": return 0xd8dee8;
    case "rainbow": return 0xff5ca8;
    case "slick": return 0x16181d;
    default: return 0x23262e;
  }
}

export function buildKart(v: Vehicle, paint: string, wheelsId: string): BuiltKart {
  const group = new THREE.Group();
  group.name = `kart:${v.id}`;
  const body = new THREE.Group();
  body.name = "kart-body";
  group.add(body);
  const paintColor = new THREE.Color(paint || v.paint);
  const dark = paintColor.clone().multiplyScalar(0.55).getHex();
  const accent = new THREE.Color(v.rarity === "legendary" ? 0xffd23f : v.rarity === "epic" ? 0x8b5cf6 : v.rarity === "rare" ? 0x2dd4c8 : 0xffffff).getHex();

  const wheels: THREE.Mesh[] = [];
  const wgeo = wheelGeo(wheelsId);
  const wmat = new THREE.MeshStandardMaterial({ color: wheelColor(wheelsId), flatShading: true, roughness: 0.6 });
  const addWheel = (x: number, z: number, scale = 1) => {
    const w = new THREE.Mesh(wgeo, wmat);
    w.position.set(x, 0.42 * scale, z);
    w.scale.setScalar(scale);
    group.add(w);
    wheels.push(w);
  };

  const P = paintColor.getHex();
  switch (v.shape) {
    case "cart": {
      body.add(mesh(BOX(1.7, 1.0, 2.4), P, 0, 0.75, 0));
      body.add(mesh(BOX(1.5, 0.15, 2.2), dark, 0, 1.05, 0));
      const handle = mesh(CYL(0.06, 0.06, 1.4), 0xc8ccd4, 0, 1.4, -1.5);
      handle.rotation.x = -0.5;
      body.add(handle);
      addWheel(-0.85, 0.85); addWheel(0.85, 0.85); addWheel(-0.85, -0.85); addWheel(0.85, -0.85);
      break;
    }
    case "bike": {
      const frame = mesh(BOX(0.24, 0.24, 1.9), P, 0, 0.62, 0);
      body.add(frame);
      body.add(mesh(BOX(0.7, 0.28, 0.5), dark, 0, 0.85, 0.35)); // seat
      body.add(mesh(BOX(0.16, 0.5, 0.9), P, 0, 0.8, -0.75)); // tank
      const bar = mesh(CYL(0.05, 0.05, 1.1), 0xc8ccd4, 0, 1.25, 0.95);
      bar.rotation.z = Math.PI / 2;
      body.add(bar);
      const col = mesh(CYL(0.05, 0.05, 1.0), 0xc8ccd4, 0, 0.95, 0.9);
      col.rotation.x = 0.35;
      body.add(col);
      addWheel(-0.42, 1.0, 1.15); addWheel(0.42, 1.0, 1.15); addWheel(-0.42, -1.0, 1.15); addWheel(0.42, -1.0, 1.15);
      break;
    }
    case "scooter":
    case "rocket": {
      body.add(mesh(BOX(0.7, 0.18, 2.2), P, 0, 0.5, 0));
      const col = mesh(CYL(0.07, 0.07, 1.1), 0xc8ccd4, 0, 1.0, 0.85);
      col.rotation.x = -0.25;
      body.add(col);
      const bar = mesh(CYL(0.05, 0.05, 0.9), 0xc8ccd4, 0, 1.5, 0.95);
      bar.rotation.z = Math.PI / 2;
      body.add(bar);
      if (v.shape === "rocket") {
        const r = mesh(CONE(0.42, 1.6, 10), 0xff4d6d, 0, 0.9, -1.3);
        r.rotation.x = -Math.PI / 2;
        body.add(r);
        body.add(mesh(CYL(0.4, 0.4, 1.0, 10), 0xd8dee8, 0, 0.9, -0.6));
      }
      addWheel(-0.35, 0.9); addWheel(0.35, 0.9); addWheel(-0.35, -0.9); addWheel(0.35, -0.9);
      break;
    }
    case "skateboard": {
      body.add(mesh(BOX(0.8, 0.12, 2.0), P, 0, 0.42, 0));
      body.add(mesh(BOX(0.8, 0.2, 0.3), accent, 0, 0.5, 1.0));
      body.add(mesh(BOX(0.8, 0.2, 0.3), accent, 0, 0.5, -1.0));
      addWheel(-0.4, 0.7, 0.55); addWheel(0.4, 0.7, 0.55); addWheel(-0.4, -0.7, 0.55); addWheel(0.4, -0.7, 0.55);
      break;
    }
    case "mower": {
      body.add(mesh(BOX(1.6, 0.7, 2.0), P, 0, 0.65, -0.2));
      body.add(mesh(CYL(0.45, 0.45, 0.5, 10), 0x23262e, 0, 1.1, 0.4));
      const handle = mesh(CYL(0.05, 0.05, 1.8), 0xc8ccd4, 0, 1.5, -1.4);
      handle.rotation.x = -0.6;
      body.add(handle);
      addWheel(-0.8, 0.8, 0.9); addWheel(0.8, 0.8, 0.9); addWheel(-0.8, -0.8, 1.2); addWheel(0.8, -0.8, 1.2);
      break;
    }
    case "tub": {
      body.add(mesh(BOX(1.8, 0.9, 2.8), P, 0, 0.75, 0));
      body.add(mesh(BOX(1.5, 0.5, 2.5), 0x87ceeb, 0, 1.15, 0)); // water
      const faucet = mesh(CYL(0.07, 0.07, 0.8), 0xd8dee8, 0, 1.5, -1.3);
      faucet.rotation.x = 0.4;
      body.add(faucet);
      const duck = mesh(SPH(0.4, 8, 6), 0xffd23f, 0.5, 1.45, 0.6);
      body.add(duck);
      addWheel(-0.8, 1.1, 0.7); addWheel(0.8, 1.1, 0.7); addWheel(-0.8, -1.1, 0.7); addWheel(0.8, -1.1, 0.7);
      break;
    }
    case "toaster": {
      body.add(mesh(BOX(1.7, 1.1, 1.3), P, 0, 0.85, 0));
      body.add(mesh(BOX(1.8, 0.12, 1.4), dark, 0, 1.42, 0));
      body.add(mesh(BOX(0.5, 0.06, 1.2), 0x16181d, -0.3, 1.48, 0));
      body.add(mesh(BOX(0.5, 0.06, 1.2), 0x16181d, 0.3, 1.48, 0));
      const lever = mesh(CYL(0.05, 0.05, 0.6), 0xff4d6d, 0.95, 1.1, 0);
      body.add(lever);
      addWheel(-0.75, 0.55); addWheel(0.75, 0.55); addWheel(-0.75, -0.55); addWheel(0.75, -0.55);
      break;
    }
    case "banana": {
      const b = mesh(new THREE.CapsuleGeometry(0.55, 1.6, 4, 10), 0xffd23f, 0, 0.75, 0);
      b.rotation.z = 0.5;
      body.add(b);
      body.add(mesh(SPH(0.3, 8, 6), 0x8a5a3b, 0, 1.15, -1.05));
      body.add(mesh(SPH(0.3, 8, 6), 0x8a5a3b, 0, 1.15, 1.05));
      addWheel(-0.6, 0.8, 0.8); addWheel(0.6, 0.8, 0.8); addWheel(-0.6, -0.8, 0.8); addWheel(0.6, -0.8, 0.8);
      break;
    }
    case "cup": {
      body.add(mesh(CYL(1.0, 0.8, 1.6, 12), P, 0, 0.9, 0));
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 8, 14), std(accent));
      handle.position.set(1.05, 0.95, 0);
      body.add(handle);
      body.add(mesh(CYL(1.5, 1.5, 0.15, 14), 0xffffff, 0, 0.16, 0)); // saucer
      addWheel(-0.8, 0.8, 0.8); addWheel(0.8, 0.8, 0.8); addWheel(-0.8, -0.8, 0.8); addWheel(0.8, -0.8, 0.8);
      break;
    }
    case "duck": {
      body.add(mesh(SPH(1.0, 12, 9), 0xffd23f, 0, 0.85, -0.2));
      body.add(mesh(SPH(0.55, 10, 8), 0xffd23f, 0.15, 1.6, 0.7));
      const beak = mesh(CONE(0.22, 0.5, 8), 0xff7f2a, 0.15, 1.55, 1.35);
      beak.rotation.x = Math.PI / 2;
      body.add(beak);
      addWheel(-0.7, 0.7, 0.75); addWheel(0.7, 0.7, 0.75); addWheel(-0.7, -0.9, 0.75); addWheel(0.7, -0.9, 0.75);
      break;
    }
    case "truck": {
      const big = v.id === "monster-truck";
      const s = big ? 1.5 : 1;
      body.add(mesh(BOX(1.8 * s, 1.1 * s, 2.6 * s), P, 0, 0.9 * s, -0.2));
      body.add(mesh(BOX(1.5 * s, 0.8 * s, 1.4 * s), v.id === "ice-cream-truck" ? 0xff9de2 : 0xd8dee8, 0, 1.7 * s, 0.7));
      if (v.id === "ice-cream-truck") {
        const cone = mesh(CONE(0.5, 1.0, 8), 0xfff8ef, 0, 2.5 * s, 0.7);
        body.add(cone);
      }
      const ws = big ? 1.6 : 0.95;
      addWheel(-0.85 * s, 1.0 * s, ws); addWheel(0.85 * s, 1.0 * s, ws); addWheel(-0.85 * s, -1.1 * s, ws); addWheel(0.85 * s, -1.1 * s, ws);
      break;
    }
    case "carpet": {
      body.add(mesh(BOX(1.6, 0.12, 2.6), P, 0, 0.55, 0));
      body.add(mesh(BOX(1.6, 0.1, 0.4), accent, 0, 0.55, 1.35));
      body.add(mesh(BOX(1.6, 0.1, 0.4), accent, 0, 0.55, -1.35));
      body.add(mesh(BOX(0.3, 0.3, 2.8), dark, 0.9, 0.6, 0));
      // hover glow instead of wheels
      addWheel(-0.7, 0.9, 0.6); addWheel(0.7, 0.9, 0.6); addWheel(-0.7, -0.9, 0.6); addWheel(0.7, -0.9, 0.6);
      break;
    }
    case "tank": {
      body.add(mesh(BOX(1.9, 0.7, 2.8), P, 0, 0.8, 0));
      body.add(mesh(BOX(2.2, 0.5, 1.2), dark, 0, 0.5, 0)); // treads
      body.add(mesh(CYL(0.7, 0.7, 0.8, 10), P, 0, 1.4, 0));
      const barrel = mesh(CYL(0.12, 0.12, 2.2), 0x23262e, 0, 1.5, 1.6);
      barrel.rotation.x = Math.PI / 2;
      body.add(barrel);
      addWheel(-1.0, 1.1, 1.0); addWheel(1.0, 1.1, 1.0); addWheel(-1.0, -1.1, 1.0); addWheel(1.0, -1.1, 1.0);
      break;
    }
    case "balloon": {
      body.add(mesh(SPH(2.0, 14, 12), P, 0, 3.2, 0));
      body.add(mesh(BOX(1.2, 0.8, 1.2), 0x8a5a3b, 0, 0.7, 0));
      for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]] as const) {
        const rope = mesh(CYL(0.03, 0.03, 1.6), 0xfff8ef, x * 0.8, 1.8, z * 0.8);
        rope.rotation.z = x * 0.4; rope.rotation.x = -z * 0.4;
        body.add(rope);
      }
      addWheel(-0.55, 0.55, 0.7); addWheel(0.55, 0.55, 0.7); addWheel(-0.55, -0.55, 0.7); addWheel(0.55, -0.55, 0.7);
      break;
    }
    case "sub": {
      const hull = mesh(new THREE.CapsuleGeometry(0.8, 2.2, 6, 12), P, 0, 0.9, 0);
      hull.rotation.z = Math.PI / 2;
      body.add(hull);
      body.add(mesh(CONE(0.5, 1.2, 8), dark, 0, 1.5, -1.6));
      body.add(mesh(CYL(0.1, 0.1, 0.9), 0xd8dee8, 0, 1.7, 0.2));
      body.add(mesh(BOX(0.1, 0.8, 0.5), dark, 0, 1.6, -0.6));
      addWheel(-0.6, 0.8, 0.8); addWheel(0.6, 0.8, 0.8); addWheel(-0.6, -0.8, 0.8); addWheel(0.6, -0.8, 0.8);
      break;
    }
    case "dino": {
      body.add(mesh(BOX(1.8, 1.2, 3.0), P, 0, 1.0, -0.3));
      body.add(mesh(BOX(1.2, 0.9, 1.2), P, 0.1, 1.9, 1.2)); // head
      body.add(mesh(BOX(0.7, 0.4, 0.5), 0xfff8ef, 0.1, 1.85, 1.85)); // snout
      const tail = mesh(CONE(0.5, 1.8, 8), P, 0, 1.1, -2.3);
      tail.rotation.x = -Math.PI / 2 - 0.3;
      body.add(tail);
      for (let i = 0; i < 3; i++) body.add(mesh(CONE(0.3, 0.7, 6), 0xfff8ef, 0, 1.75, -0.6 + i * 0.8));
      addWheel(-0.85, 1.1, 1.1); addWheel(0.85, 1.1, 1.1); addWheel(-0.85, -1.2, 1.1); addWheel(0.85, -1.2, 1.1);
      break;
    }
    case "ufo": {
      body.add(mesh(CYL(2.2, 1.6, 0.6, 14), P, 0, 0.9, 0));
      const dome = mesh(SPH(1.1, 12, 8), 0x9bf0ff, 0, 1.5, 0, { transparent: true, opacity: 0.75 });
      body.add(dome);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        body.add(mesh(SPH(0.18, 6, 5), 0xffd23f, Math.cos(a) * 1.8, 0.75, Math.sin(a) * 1.8, { emissive: 0xffd23f, emissiveIntensity: 1 }));
      }
      addWheel(-0.8, 0.8, 0.5); addWheel(0.8, 0.8, 0.5); addWheel(-0.8, -0.8, 0.5); addWheel(0.8, -0.8, 0.5);
      break;
    }
    case "chariot": {
      body.add(mesh(BOX(1.4, 0.4, 2.2), P, 0, 0.7, 0));
      body.add(mesh(CYL(0.9, 0.9, 0.3, 12), 0xfff8ef, 0, 0.9, 0));
      for (const x of [-0.75, 0.75]) {
        const pillar = mesh(CYL(0.07, 0.07, 1.2), 0xffd23f, x, 1.5, -0.9);
        body.add(pillar);
      }
      body.add(mesh(BOX(1.7, 0.12, 0.5), 0xffd23f, 0, 2.1, -0.9)); // canopy
      const wgeo = new THREE.CylinderGeometry(0.75, 0.75, 0.25, 14);
      wgeo.rotateX(Math.PI / 2);
      const wmat = new THREE.MeshStandardMaterial({ color: 0xd8b23f, flatShading: true, metalness: 0.7, roughness: 0.3 });
      for (const z of [0.9, -0.9]) {
        const w = new THREE.Mesh(wgeo, wmat);
        w.position.set(0.85, 0.75, z);
        group.add(w); wheels.push(w);
        const w2 = w.clone(); w2.position.x = -0.85; group.add(w2); wheels.push(w2);
      }
      break;
    }
    default: {
      // generic kart
      body.add(mesh(BOX(1.5, 0.5, 2.4), P, 0, 0.6, 0));
      body.add(mesh(BOX(1.2, 0.5, 0.8), dark, 0, 0.95, -0.5)); // seat back
      body.add(mesh(BOX(1.6, 0.25, 0.6), P, 0, 0.75, 1.2)); // nose
      const spoiler = mesh(BOX(1.6, 0.1, 0.5), accent, 0, 1.25, -1.2);
      body.add(spoiler);
      addWheel(-0.8, 0.9); addWheel(0.8, 0.9); addWheel(-0.8, -0.9); addWheel(0.8, -0.9);
    }
  }

  // exhaust pipes (flame particles anchor)
  const exhaust = mesh(CYL(0.09, 0.09, 0.5), 0x23262e, -0.4, 0.6, -1.35);
  exhaust.rotation.x = Math.PI / 2;
  body.add(exhaust);
  const exhaust2 = exhaust.clone();
  exhaust2.position.x = 0.4;
  body.add(exhaust2);

  return { group, wheels, body };
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

const CHAR_SKIN: Record<string, number> = {
  cappy: 0xffd9b3, bean: 0xc8e6a0, mocha: 0xb98a5e, pickles: 0x9fe08a, nova: 0xcbb8ff, ziggy: 0xffc98a,
};
const CHAR_SUIT: Record<string, number> = {
  cappy: 0xff5ca8, bean: 0x3ddc84, mocha: 0x8a5a3b, pickles: 0x4fae4f, nova: 0x8b5cf6, ziggy: 0xffd23f,
};

export function buildDriver(character: Cosmetic, hatId: string): { group: THREE.Group } {
  const g = new THREE.Group();
  g.name = `driver:${character.id}/${hatId}`;
  const skin = CHAR_SKIN[character.id] ?? 0xffd9b3;
  const suit = CHAR_SUIT[character.id] ?? 0xff5ca8;

  const torso = mesh(BOX(0.85, 0.8, 0.55), suit, 0, 0.75, -0.1);
  const head = mesh(SPH(0.42, 12, 10), skin, 0, 1.5, 0.05);
  const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
  const eyeB = new THREE.MeshStandardMaterial({ color: 0x16181d, flatShading: true });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), eyeW);
  eyeL.position.set(-0.16, 1.55, 0.4);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.16;
  const pupL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), eyeB);
  pupL.position.set(-0.16, 1.55, 0.51);
  const pupR = pupL.clone(); pupR.position.x = 0.16;
  const armL = mesh(CYL(0.09, 0.09, 0.7), suit, -0.52, 0.95, 0.15);
  armL.rotation.z = 0.7; armL.rotation.x = -0.5;
  const armR = mesh(CYL(0.09, 0.09, 0.7), suit, 0.52, 0.95, 0.15);
  armR.rotation.z = -0.7; armR.rotation.x = -0.5;
  g.add(torso, head, eyeL, eyeR, pupL, pupR, armL, armR);

  // hats
  switch (hatId) {
    case "crown": {
      g.add(mesh(CYL(0.34, 0.38, 0.28, 8), 0xffd23f, 0, 1.95, 0.05, { metalness: 0.7, roughness: 0.25 }));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(mesh(CONE(0.09, 0.22, 4), 0xffd23f, Math.cos(a) * 0.3, 2.18, 0.05 + Math.sin(a) * 0.3));
      }
      break;
    }
    case "duck-hat": {
      g.add(mesh(SPH(0.3, 8, 6), 0xffd23f, 0, 1.9, 0.1));
      const beak = mesh(CONE(0.12, 0.25, 6), 0xff7f2a, 0, 1.88, 0.42);
      beak.rotation.x = Math.PI / 2;
      g.add(beak);
      break;
    }
    case "viking": {
      g.add(mesh(CYL(0.4, 0.42, 0.3, 8), 0xc8ccd4, 0, 1.92, 0.05, { metalness: 0.5, roughness: 0.4 }));
      for (const x of [-0.38, 0.38]) {
        const horn = mesh(CONE(0.1, 0.4, 6), 0xfff8ef, x, 2.1, 0.05);
        horn.rotation.z = x > 0 ? -0.5 : 0.5;
        g.add(horn);
      }
      break;
    }
    case "party": {
      const cone = mesh(CONE(0.32, 0.7, 8), 0xff5ca8, 0, 2.15, 0.05);
      cone.rotation.z = 0.15;
      g.add(cone);
      g.add(mesh(SPH(0.1, 6, 5), 0xffd23f, 0.08, 2.5, 0.05));
      break;
    }
    case "propeller": {
      g.add(mesh(CYL(0.34, 0.36, 0.16, 8), 0x2dd4c8, 0, 1.92, 0.05));
      const stick = mesh(CYL(0.04, 0.04, 0.25), 0x23262e, 0, 2.08, 0.05);
      g.add(stick);
      const blade = mesh(BOX(0.9, 0.06, 0.16), 0xffd23f, 0, 2.22, 0.05);
      blade.name = "propeller-blade";
      g.add(blade);
      break;
    }
    case "chef": {
      g.add(mesh(CYL(0.36, 0.36, 0.4, 10), 0xffffff, 0, 1.95, 0.05));
      g.add(mesh(CYL(0.3, 0.34, 0.2, 10), 0xf0f0f0, 0, 2.2, 0.05));
      break;
    }
    default:
      // "none" — maybe a racing cap for cappy
      if (character.id === "cappy") {
        g.add(mesh(new THREE.SphereGeometry(0.44, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xff5ca8, 0, 1.62, 0.05));
        g.add(mesh(CYL(0.42, 0.46, 0.1, 12), 0xff5ca8, 0, 1.6, 0.35));
      }
      break;
  }
  return { group: g };
}

// ---------------------------------------------------------------------------
// re-export for convenience
export { trackById, WHEELS };
