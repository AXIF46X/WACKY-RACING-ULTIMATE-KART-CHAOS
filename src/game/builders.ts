// ============================================================================
// WACKY RACING — procedural 3D builders: tracks, karts, characters, hazards
// All geometry is generated at runtime from primitives (100% original assets).
// ============================================================================
import * as THREE from "three";
import type { CharacterDef, TrackDef, VehicleDef } from "./data";

// Shared material cache (flat cartoon shading, happy colors)
const matCache = new Map<string, THREE.MeshLambertMaterial>();
export function mat(color: string, opts: { emissive?: string; transparent?: boolean; opacity?: number; flat?: boolean } = {}): THREE.MeshLambertMaterial {
  const key = `${color}|${opts.emissive ?? ""}|${opts.transparent ? opts.opacity ?? 1 : ""}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    });
    matCache.set(key, m);
  }
  return m;
}

export function box(w: number, h: number, d: number, color: string, opts?: Parameters<typeof mat>[1]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.castShadow = true;
  return m;
}
export function cyl(rt: number, rb: number, h: number, color: string, seg = 12, opts?: Parameters<typeof mat>[1]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, opts));
  m.castShadow = true;
  return m;
}
export function sph(r: number, color: string, seg = 14, opts?: Parameters<typeof mat>[1]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4)), mat(color, opts));
  m.castShadow = true;
  return m;
}
export function cone(r: number, h: number, color: string, seg = 12, opts?: Parameters<typeof mat>[1]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color, opts));
  m.castShadow = true;
  return m;
}
export function tor(r: number, tube: number, color: string, arc = Math.PI * 2, opts?: Parameters<typeof mat>[1]): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 20, arc), mat(color, opts));
  m.castShadow = true;
  return m;
}

// ============================================================================
// TRACK BUILDING
// ============================================================================
export interface TrackSample {
  pos: THREE.Vector3;
  tan: THREE.Vector3;
  lat: THREE.Vector3; // lateral (left) unit vector
  yaw: number;
  width: number;
  i: number;
}

export interface BuiltObstacle {
  type: "spinner" | "mover" | "bouncer";
  group: THREE.Group;
  center: THREE.Vector3;
  lane: number;
  basePos: THREE.Vector3;
  lat: THREE.Vector3;
  tan: THREE.Vector3;
  width: number;
  speed: number;
  phase: number;
  angle: number;
  ballA?: THREE.Vector3;
  ballB?: THREE.Vector3;
  mesh?: THREE.Object3D;
  radius: number;
}

export interface BuiltRamp {
  group: THREE.Group;
  index: number;
  lane: number;
  center: THREE.Vector3;
  lat: THREE.Vector3;
  tan: THREE.Vector3;
}

export interface BuiltTrack {
  group: THREE.Group;
  samples: TrackSample[];
  length: number;
  startYaw: number;
  obstacles: BuiltObstacle[];
  ramps: BuiltRamp[];
  pickupSpots: THREE.Vector3[];
  coinSpots: THREE.Vector3[];
  minimap: [number, number][];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const SAMPLE_COUNT = 700;

export function buildTrack(def: TrackDef): BuiltTrack {
  const group = new THREE.Group();
  const pts = def.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.55);
  const raw = curve.getSpacedPoints(SAMPLE_COUNT);
  raw.pop(); // close loop cleanly

  const samples: TrackSample[] = raw.map((p, i) => {
    const next = raw[(i + 1) % raw.length];
    const prev = raw[(i - 1 + raw.length) % raw.length];
    const tan = new THREE.Vector3().subVectors(next, prev).setY(0).normalize();
    const lat = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    return { pos: p.clone(), tan, lat, yaw: Math.atan2(tan.x, tan.z), width: def.width, i };
  });

  // --- track ribbon ---------------------------------------------------------
  const hw = def.width / 2;
  const trackVerts: number[] = [];
  const trackIdx: number[] = [];
  const curbVertsA: number[] = [];
  const curbVertsB: number[] = [];
  const curbIdxA: number[] = [];
  const curbIdxB: number[] = [];
  const CURB_W = 0.9;
  const N = samples.length;
  for (let i = 0; i < N; i++) {
    const s = samples[i];
    const l = s.pos.clone().addScaledVector(s.lat, -hw);
    const r = s.pos.clone().addScaledVector(s.lat, hw);
    trackVerts.push(l.x, 0, l.z, r.x, 0, r.z);
    const lo = l.clone().addScaledVector(s.lat, -CURB_W);
    const ro = r.clone().addScaledVector(s.lat, CURB_W);
    curbVertsA.push(lo.x, 0.02, lo.z, l.x, 0.02, l.z);
    curbVertsB.push(r.x, 0.02, r.z, ro.x, 0.02, ro.z);
    const a = i * 2;
    const b = ((i + 1) % N) * 2;
    trackIdx.push(a, b, a + 1, b, b + 1, a + 1);
    curbIdxA.push(a, b, a + 1, b, b + 1, a + 1);
    curbIdxB.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const trackGeo = new THREE.BufferGeometry();
  trackGeo.setAttribute("position", new THREE.Float32BufferAttribute(trackVerts, 3));
  trackGeo.setIndex(trackIdx);
  trackGeo.computeVertexNormals();
  const trackMesh = new THREE.Mesh(trackGeo, mat(def.theme.track));
  trackMesh.receiveShadow = true;
  group.add(trackMesh);
  for (const [verts, idx, color] of [
    [curbVertsA, curbIdxA, def.theme.curbA],
    [curbVertsB, curbIdxB, def.theme.curbB],
  ] as [number[], number[], string][]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat(color));
    m.receiveShadow = true;
    group.add(m);
  }

  // --- start/finish checker line -------------------------------------------
  const s0 = samples[0];
  for (let k = -4; k < 4; k++) {
    const tile = box(def.width / 8, 0.04, 0.62, k % 2 === 0 ? "#ffffff" : "#16181d");
    const p = s0.pos.clone().addScaledVector(s0.lat, (k + 0.5) * (def.width / 8));
    tile.position.set(p.x, 0.03, p.z);
    tile.rotation.y = s0.yaw;
    tile.receiveShadow = true;
    group.add(tile);
    const tile2 = tile.clone();
    tile2.material = mat(k % 2 === 0 ? "#16181d" : "#ffffff");
    const p2 = s0.pos.clone().addScaledVector(s0.lat, (k + 0.5) * (def.width / 8)).addScaledVector(s0.tan, 0.62);
    tile2.position.set(p2.x, 0.03, p2.z);
    group.add(tile2);
  }
  // start banner arch
  const arch = new THREE.Group();
  const postL = cyl(0.35, 0.4, 7.4, "#ff4d6d");
  postL.position.set(-hw - 1.6, 3.7, 0);
  const postR = postL.clone();
  postR.material = mat("#4fc3f7");
  postR.position.set(hw + 1.6, 3.7, 0);
  const beam = box(2 * hw + 4.5, 1.5, 0.8, "#ffd23f");
  beam.position.set(0, 7.6, 0);
  const flagL = cone(0.7, 1.4, "#ff4d6d");
  flagL.position.set(-hw - 1.6, 8.9, 0);
  const flagR = cone(0.7, 1.4, "#4fc3f7");
  flagR.position.set(hw + 1.6, 8.9, 0);
  arch.add(postL, postR, beam, flagL, flagR);
  arch.position.copy(s0.pos);
  arch.rotation.y = s0.yaw + Math.PI / 2;
  group.add(arch);

  // --- ground plane ---------------------------------------------------------
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 40), mat(def.theme.ground));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  group.add(ground);

  // --- obstacles ------------------------------------------------------------
  const obstacles: BuiltObstacle[] = def.obstacles.map((o, idx) => {
    const si = Math.floor(o.at * N) % N;
    const s = samples[si];
    const basePos = s.pos.clone().addScaledVector(s.lat, o.lane);
    const og = new THREE.Group();
    const ob: BuiltObstacle = {
      type: o.type, group: og, center: s.pos.clone(), lane: o.lane, basePos,
      lat: s.lat.clone(), tan: s.tan.clone(), width: def.width,
      speed: o.speed ?? 1, phase: idx * 1.7, angle: 0, radius: 1.3,
    };
    if (o.type === "spinner") {
      const poleC = cyl(0.5, 0.62, 2.6, "#8d6e63");
      poleC.position.set(basePos.x, 1.3, basePos.z);
      const bar = new THREE.Group();
      const barMesh = box(def.width * 1.15, 0.5, 0.5, "#ff7f2a");
      barMesh.position.y = 1.15;
      const ball1 = sph(1.15, "#ff4d6d");
      ball1.position.set(def.width * 0.575, 1.15, 0);
      const ball2 = sph(1.15, "#4fc3f7");
      ball2.position.set(-def.width * 0.575, 1.15, 0);
      bar.add(barMesh, ball1, ball2);
      bar.position.set(basePos.x, 0, basePos.z);
      og.add(poleC, bar);
      ob.mesh = bar;
      ob.radius = 1.35;
    } else if (o.type === "mover") {
      const block = box(3.4, 2.8, 2.2, "#c792ff");
      block.position.copy(basePos);
      block.position.y = 1.4;
      const eyes = sph(0.35, "#ffffff");
      eyes.position.set(0.7, 0.5, 1.12);
      const eyes2 = eyes.clone();
      eyes2.position.x = -0.7;
      const pupil = sph(0.16, "#16181d");
      pupil.position.set(0.7, 0.5, 1.42);
      const pupil2 = pupil.clone();
      pupil2.position.x = -0.7;
      block.add(eyes, eyes2, pupil, pupil2);
      og.add(block);
      ob.mesh = block;
      ob.radius = 1.9;
    } else {
      const ball = sph(1.7, "#ffe066");
      const stripe = tor(1.68, 0.22, "#ff4d6d");
      stripe.rotation.x = Math.PI / 2;
      ball.add(stripe);
      ball.position.copy(basePos).setY(1.7);
      og.add(ball);
      ob.mesh = ball;
      ob.radius = 1.9;
    }
    group.add(og);
    return ob;
  });

  // --- ramps ----------------------------------------------------------------
  const ramps: BuiltRamp[] = def.ramps.map((r) => {
    const si = Math.floor(r.at * N) % N;
    const s = samples[si];
    const center = s.pos.clone().addScaledVector(s.lat, r.lane);
    const rg = new THREE.Group();
    const wedge = box(5.4, 0.5, 4.6, "#b6f34d");
    wedge.rotation.x = -0.28;
    wedge.position.set(0, 0.65, 0);
    const nose = box(5.4, 0.5, 0.7, "#8ee63e");
    nose.position.set(0, 1.25, -2.15);
    const stripes = box(5.5, 0.06, 0.6, "#16181d");
    stripes.rotation.x = -0.28;
    stripes.position.set(0, 0.95, 0.4);
    rg.add(wedge, nose, stripes);
    rg.position.copy(center);
    rg.rotation.y = s.yaw;
    group.add(rg);
    return { group: rg, index: si, lane: r.lane, center, lat: s.lat.clone(), tan: s.tan.clone() };
  });

  // --- pickups & coins ------------------------------------------------------
  const pickupSpots: THREE.Vector3[] = [];
  for (const t of def.pickups) {
    const s = samples[Math.floor(t * N) % N];
    for (const lane of [-3.1, 0, 3.1]) {
      pickupSpots.push(s.pos.clone().addScaledVector(s.lat, Math.max(-hw + 1.2, Math.min(hw - 1.2, lane))));
    }
  }
  const coinSpots: THREE.Vector3[] = [];
  for (const row of def.coinRows) {
    const s = samples[Math.floor(row.at * N) % N];
    for (const lane of row.lanes) {
      for (let k = -1; k <= 1; k++) {
        coinSpots.push(
          s.pos.clone().addScaledVector(s.lat, Math.max(-hw + 1, Math.min(hw - 1, lane))).addScaledVector(s.tan, k * 2.4).setY(1.1),
        );
      }
    }
  }

  // --- theme decoration -----------------------------------------------------
  scatterDecor(group, samples, def, hw);

  // bounds + minimap
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  const minimap: [number, number][] = [];
  for (let i = 0; i < N; i += 5) {
    const p = samples[i].pos;
    minimap.push([p.x, p.z]);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const length = curve.getLength();
  return { group, samples, length, startYaw: samples[0].yaw, obstacles, ramps, pickupSpots, coinSpots, minimap, bounds: { minX, maxX, minZ, maxZ } };
}

// ---------------------------------------------------------------------------
// Theme decorations
// ---------------------------------------------------------------------------
function placeOutside(g: THREE.Group, samples: TrackSample[], hw: number, every: number, make: () => THREE.Object3D, side = 0, yBase = 0, minOff = 5, spread = 26) {
  const N = samples.length;
  for (let i = 0; i < N; i += every) {
    if (Math.random() < 0.18) continue;
    const s = samples[i];
    const dir = side === 0 ? (Math.random() < 0.5 ? -1 : 1) : side;
    const off = hw + minOff + Math.random() * spread;
    const obj = make();
    obj.position.copy(s.pos).addScaledVector(s.lat, dir * off);
    obj.position.y = yBase + obj.position.y;
    obj.rotation.y = Math.random() * Math.PI * 2;
    const sc = 0.75 + Math.random() * 0.7;
    obj.scale.setScalar(sc);
    g.add(obj);
  }
}

function scatterDecor(group: THREE.Group, samples: TrackSample[], def: TrackDef, hw: number) {
  const T = def.theme;
  const rnd = (a: string, b: string) => (Math.random() < 0.5 ? a : b);
  switch (T.decor) {
    case "candy": {
      placeOutside(group, samples, hw, 24, () => {
        const gp = new THREE.Group();
        const c = cyl(0.28, 0.28, 5, "#ffffff");
        c.position.y = 2.5;
        const stripe = cyl(0.3, 0.3, 0.9, "#ff5ca8");
        stripe.position.y = 1.4;
        const stripe2 = stripe.clone();
        stripe2.position.y = 2.6;
        const stripe3 = stripe.clone();
        stripe3.position.y = 3.8;
        const hook = tor(0.85, 0.28, "#ff5ca8", Math.PI);
        hook.position.y = 5;
        gp.add(c, stripe, stripe2, stripe3, hook);
        return gp;
      });
      placeOutside(group, samples, hw, 31, () => {
        const gp = new THREE.Group();
        const stick = cyl(0.16, 0.16, 3.4, "#fff7e6");
        stick.position.y = 1.7;
        const pop = sph(1.25, rnd("#ff9de2", "#66e0ff"));
        pop.position.y = 4.2;
        pop.scale.z = 0.45;
        gp.add(stick, pop);
        return gp;
      });
      placeOutside(group, samples, hw, 40, () => {
        const g = new THREE.Group();
        const base = cyl(1.3, 0.7, 1.6, "#e0aaff");
        base.position.y = 0.8;
        const top = sph(1.1, rnd("#ffd23f", "#ff5ca8"));
        top.position.y = 2.2;
        const cherry = sph(0.35, "#e63946");
        cherry.position.y = 3.2;
        g.add(base, top, cherry);
        return g;
      });
      break;
    }
    case "porcelain": {
      placeOutside(group, samples, hw, 22, () => {
        const gp = new THREE.Group();
        const handle = cyl(0.18, 0.18, 4.4, "#b5824f");
        handle.position.y = 2.2;
        const cup = cyl(0.9, 0.5, 1.1, "#e63946");
        cup.position.y = 0.55;
        gp.add(handle, cup);
        return gp;
      });
      placeOutside(group, samples, hw, 26, () => duckDecor(), 0, 0, 5, 30);
      placeOutside(group, samples, hw, 17, () => sph(0.9 + Math.random() * 0.8, "#bfe8ef", 12, { transparent: true, opacity: 0.45 }), 0, 2.5, 4, 24);
      break;
    }
    case "jungle": {
      placeOutside(group, samples, hw, 15, () => {
        const gp = new THREE.Group();
        const trunk = cyl(0.3, 0.5, 4.5, "#7a5230");
        trunk.position.y = 2.25;
        const leaf1 = cone(2.4, 3.4, rnd("#1f6b3a", "#2e8b57"));
        leaf1.position.y = 5.4;
        const leaf2 = cone(1.8, 2.6, "#35a06b");
        leaf2.position.y = 7.2;
        gp.add(trunk, leaf1, leaf2);
        return gp;
      });
      placeOutside(group, samples, hw, 30, () => {
        const gp = new THREE.Group();
        for (let i = 0; i < 4; i++) {
          const b = box(0.9, 2.2, 0.5, "#ffd23f");
          b.rotation.z = 0.5 + i * 0.32;
          b.position.y = 0.9;
          gp.add(b);
        }
        return gp;
      });
      placeOutside(group, samples, hw, 19, () => sph(1.6, rnd("#236b45", "#2e8b57")), 0, 0.4, 4, 10);
      break;
    }
    case "toy": {
      placeOutside(group, samples, hw, 20, () => {
        const b = box(2.6, 2.6, 2.6, rnd("#ff4d6d", rnd("#4fc3f7", "#ffd23f")));
        b.position.y = 1.3;
        const letter = box(2.0, 2.0, 0.2, "#ffffff");
        letter.position.set(0, 1.3, 1.32);
        const gp = new THREE.Group();
        gp.add(b, letter);
        return gp;
      });
      placeOutside(group, samples, hw, 34, () => {
        const gp = new THREE.Group();
        const bodyG = sph(1.4, "#b5824f");
        bodyG.position.y = 1.4;
        const head = sph(0.9, "#c99a63");
        head.position.y = 3;
        const earL = sph(0.35, "#8d5a2b");
        earL.position.set(0.6, 3.7, 0);
        const earR = earL.clone();
        earR.position.x = -0.6;
        gp.add(bodyG, head, earL, earR);
        return gp;
      });
      placeOutside(group, samples, hw, 26, () => {
        const gp = new THREE.Group();
        const c = cyl(1.8, 1.8, 0.7, rnd("#a06cd5", "#ff7f2a"));
        c.rotation.x = Math.PI / 2;
        c.position.y = 2.4;
        for (let i = 0; i < 6; i++) {
          const tooth = box(0.5, 0.7, 0.6, "#4a4a55");
          tooth.position.set(Math.cos((i * Math.PI) / 3) * 2, 2.4 + Math.sin((i * Math.PI) / 3) * 2, 0);
          gp.add(tooth);
        }
        gp.add(c);
        return gp;
      });
      break;
    }
    case "sky": {
      placeOutside(group, samples, hw, 20, () => cloudDecor(), 0, 10, 10, 80);
      placeOutside(group, samples, hw, 60, () => {
        const gp = new THREE.Group();
        const colors = ["#ff5ca8", "#ffd23f", "#28c76f", "#4fc3f7"];
        colors.forEach((c, i) => {
          const arc = tor(9 - i * 1.3, 0.5, c, Math.PI);
          gp.add(arc);
        });
        gp.position.y = 2;
        return gp;
      }, 0, 0, 30, 60);
      break;
    }
    case "volcano": {
      placeOutside(group, samples, hw, 22, () => cone(2 + Math.random() * 2.4, 5 + Math.random() * 5, rnd("#4a3436", "#5d4447")));
      placeOutside(group, samples, hw, 46, () => {
        const gp = new THREE.Group();
        const m = cone(7, 9, "#5d4447");
        m.position.y = 4.5;
        const glow = cyl(2.6, 3.4, 0.5, "#ff7f2a", 12, { emissive: "#ff4d00" });
        glow.position.y = 8.9;
        gp.add(m, glow);
        return gp;
      }, 0, 0, 26, 90);
      placeOutside(group, samples, hw, 16, () => {
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + Math.random(), 0), mat("#3a2a2c"));
        rock.castShadow = true;
        return rock;
      }, 0, 0, 5, 40);
      break;
    }
    case "ice": {
      placeOutside(group, samples, hw, 21, () => {
        const gp = new THREE.Group();
        const trunk = cyl(0.25, 0.35, 2.4, "#6b4526");
        trunk.position.y = 1.2;
        const leaf = cone(2, 4.2, "#e8f8ff");
        leaf.position.y = 4.3;
        const leaf2 = cone(1.4, 2.6, "#c9ecff");
        leaf2.position.y = 6;
        gp.add(trunk, leaf, leaf2);
        return gp;
      });
      placeOutside(group, samples, hw, 30, () => {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + Math.random() * 2.5, 0), mat(rnd("#d8f4ff", "#a8e4ff")));
        b.castShadow = true;
        return b;
      });
      placeOutside(group, samples, hw, 44, () => penguinDecor(), 0, 0, 4, 10);
      break;
    }
    case "alien": {
      placeOutside(group, samples, hw, 18, () => {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(1.2 + Math.random() * 1.6, 0), mat(rnd("#64ffda", "#c792ff"), { emissive: rnd("#1b998b", "#7b2ff7") }));
        c.castShadow = true;
        c.position.y = 1.5;
        return c;
      });
      placeOutside(group, samples, hw, 28, () => {
        const gp = new THREE.Group();
        const stem = cyl(0.3, 0.4, 2.2, "#d8f7c9");
        stem.position.y = 1.1;
        const cap = sph(1.2, "#ff5ca8", 12, { emissive: "#701238" });
        cap.scale.y = 0.6;
        cap.position.y = 2.4;
        gp.add(stem, cap);
        return gp;
      });
      placeOutside(group, samples, hw, 70, () => {
        const gp = new THREE.Group();
        const dish = sph(2.6, "#c8ccd4");
        dish.scale.y = 0.35;
        const dome = sph(1.1, "#66e0ff", 12, { transparent: true, opacity: 0.6 });
        dome.position.y = 0.7;
        gp.add(dish, dome);
        return gp;
      }, 0, 14, 20, 70);
      break;
    }
  }
  // crowd balloons near the start line for every theme
  for (let i = 0; i < 6; i++) {
    const s = samples[(i * 3 + 2) % samples.length];
    const dir = i % 2 === 0 ? -1 : 1;
    const g = new THREE.Group();
    const b = sph(1.15, ["#ff5ca8", "#ffd23f", "#28c76f", "#4fc3f7", "#a06cd5", "#ff7f2a"][i]);
    b.scale.y = 1.2;
    const knot = cone(0.2, 0.4, "#16181d");
    knot.position.y = -1.5;
    knot.rotation.x = Math.PI;
    const string = cyl(0.03, 0.03, 3, "#f5f5f5");
    string.position.y = -3.2;
    g.add(b, knot, string);
    g.position.copy(s.pos).addScaledVector(s.lat, dir * (hw + 5 + i));
    g.position.y = 7 + (i % 3);
    group.add(g);
  }
}

function cloudDecor(): THREE.Group {
  const gp = new THREE.Group();
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const s = sph(1.6 + Math.random() * 1.4, "#ffffff");
    s.position.set(i * 1.9 - n, Math.random() * 0.8, Math.random());
    s.scale.y = 0.65;
    gp.add(s);
  }
  return gp;
}

function duckDecor(): THREE.Group {
  const gp = new THREE.Group();
  const body = sph(1.1, "#ffd23f");
  body.scale.set(1.2, 0.95, 1);
  body.position.y = 1;
  const head = sph(0.65, "#ffd23f");
  head.position.set(0.75, 2, 0);
  const beak = cone(0.25, 0.5, "#ff7f2a");
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(1.45, 1.95, 0);
  const eye = sph(0.11, "#16181d");
  eye.position.set(1.05, 2.2, 0.42);
  const eye2 = eye.clone();
  eye2.position.z = -0.42;
  gp.add(body, head, beak, eye, eye2);
  return gp;
}

function penguinDecor(): THREE.Group {
  const gp = new THREE.Group();
  const body = sph(0.75, "#21293c");
  body.scale.y = 1.25;
  body.position.y = 0.95;
  const belly = sph(0.55, "#f5f5f5");
  belly.scale.y = 1.15;
  belly.position.set(0, 0.9, 0.3);
  const head = sph(0.45, "#21293c");
  head.position.y = 1.9;
  const beak = cone(0.14, 0.32, "#ff7f2a");
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.85, 0.5);
  gp.add(body, belly, head, beak);
  return gp;
}

// ============================================================================
// KART BUILDING
// ============================================================================
export interface BuiltKart {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  driver: THREE.Group;
  driverParts: { head?: THREE.Object3D; armL?: THREE.Object3D; armR?: THREE.Object3D; body?: THREE.Object3D };
  flame: THREE.Group;
  body: THREE.Group;
}

function wheel(color: string, size: number, style: string): THREE.Group {
  const w = new THREE.Group();
  if (style === "donut") {
    const d = tor(size * 0.72, size * 0.3, "#c98a4b");
    const icing = tor(size * 0.72, size * 0.31, "#ff9de2", Math.PI * 2);
    icing.scale.setScalar(0.99);
    icing.position.x = -0.02;
    w.add(d, icing);
    w.rotation.y = Math.PI / 2;
    return w;
  }
  const tire = cyl(size, size, size * (style === "monster" ? 0.95 : 0.62), style === "slick" ? "#ff9de2" : "#21293c", 16);
  tire.rotation.z = Math.PI / 2;
  const hub = cyl(size * 0.45, size * 0.45, size * 0.66 + 0.02, color, 10);
  hub.rotation.z = Math.PI / 2;
  w.add(tire, hub);
  return w;
}

export function buildKart(veh: VehicleDef, paint: string, wheelStyle: string): BuiltKart {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const addWheel = (x: number, y: number, z: number, size: number) => {
    const w = wheel(paint, size, wheelStyle);
    w.position.set(x, y, z);
    group.add(w);
    wheels.push(w);
    return w;
  };
  let wheelS = 0.42;

  switch (veh.id) {
    case "shopping-cart": {
      const frame = box(1.9, 0.1, 2.9, "#9fb4c7");
      frame.position.y = 0.55;
      const basket = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const barF = box(1.9, 0.07, 0.07, paint);
        barF.position.set(0, 0.75 + i * 0.22, -1.45);
        const barB = barF.clone();
        barB.position.z = 1.45;
        const barL = box(0.07, 0.07, 2.9, paint);
        barL.position.set(-0.95, 0.75 + i * 0.22, 0);
        const barR = barL.clone();
        barR.position.x = 0.95;
        basket.add(barF, barB, barL, barR);
      }
      const handle = box(2.1, 0.09, 0.09, paint);
      handle.position.set(0, 1.75, -1.6);
      body.add(frame, basket, handle);
      wheelS = 0.34;
      break;
    }
    case "chicken-bike": {
      const bod = sph(0.95, "#fbf3df");
      bod.scale.set(1.15, 0.95, 1);
      bod.position.y = 1.15;
      const head = sph(0.45, "#fbf3df");
      head.position.set(0, 1.95, 1.05);
      const comb = box(0.14, 0.4, 0.5, "#e63946");
      comb.position.set(0, 2.35, 1.02);
      const beak = cone(0.16, 0.35, "#ff7f2a");
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 1.9, 1.5);
      const wingL = box(0.12, 0.7, 0.9, "#f0e2c8");
      wingL.position.set(-0.95, 1.15, 0);
      wingL.rotation.z = 0.25;
      const wingR = wingL.clone();
      wingR.position.x = 0.95;
      wingR.rotation.z = -0.25;
      const tail = cone(0.3, 0.8, "#e63946");
      tail.rotation.x = -Math.PI / 2.4;
      tail.position.set(0, 1.35, -1.15);
      const bar = box(1.5, 0.09, 0.09, paint);
      bar.position.set(0, 1.65, 1.3);
      body.add(bod, head, comb, beak, wingL, wingR, tail, bar);
      wheelS = 0.52;
      break;
    }
    case "pizza-scooter": {
      const floor = box(1.3, 0.22, 2.6, paint);
      floor.position.y = 0.6;
      const column = box(1.1, 1.1, 0.4, paint);
      column.position.set(0, 1.1, 1.25);
      column.rotation.x = -0.18;
      const barH = box(1.3, 0.09, 0.09, "#21293c");
      barH.position.set(0, 1.72, 1.12);
      const boxP = box(1.5, 0.35, 1.5, "#f0e2c8");
      boxP.position.set(0, 1.1, -1.15);
      const logo = cyl(0.5, 0.5, 0.06, "#e63946");
      logo.position.set(0, 1.3, -1.15);
      body.add(floor, column, barH, boxP, logo);
      wheelS = 0.38;
      break;
    }
    case "bathtub-racer": {
      const tub = cyl(1.05, 0.85, 0.95, "#f5f9ff", 16);
      tub.scale.z = 1.7;
      tub.position.y = 0.95;
      const rim = tor(1.02, 0.12, "#bfe8ef");
      rim.rotation.x = Math.PI / 2;
      rim.scale.y = 1.7;
      rim.position.y = 1.45;
      const water = cyl(0.92, 0.92, 0.08, "#66e0ff", 14, { transparent: true, opacity: 0.8 });
      water.scale.z = 1.65;
      water.position.y = 1.42;
      const faucet = tor(0.35, 0.09, "#c8ccd4", Math.PI);
      faucet.position.set(0, 1.7, 1.45);
      const duck = sph(0.3, "#ffd23f");
      duck.position.set(0.4, 1.55, -0.9);
      body.add(tub, rim, water, faucet, duck);
      wheelS = 0.34;
      break;
    }
    case "rocket-scooter": {
      const desk = box(1.2, 0.2, 2.4, paint);
      desk.position.y = 0.6;
      const column = box(0.3, 1.3, 0.3, "#c8ccd4");
      column.position.set(0, 1.25, 1.05);
      const barH = box(1.2, 0.09, 0.09, "#21293c");
      barH.position.set(0, 1.95, 1.0);
      const rocket = cyl(0.55, 0.62, 1.9, "#e63946");
      rocket.rotation.x = Math.PI / 2 - 0.12;
      rocket.position.set(0, 1.15, -1.15);
      const nose = cone(0.55, 0.8, "#ffd23f");
      nose.rotation.x = Math.PI / 2 - 0.12;
      nose.position.set(0, 1.02, -2.35);
      const finL = box(0.08, 0.6, 0.7, "#ffd23f");
      finL.position.set(-0.62, 1.35, -1.4);
      const finR = finL.clone();
      finR.position.x = 0.62;
      body.add(desk, column, barH, rocket, nose, finL, finR);
      wheelS = 0.36;
      break;
    }
    case "banana-mobile": {
      const ban = tor(1.7, 0.62, "#ffd23f", Math.PI * 0.85);
      ban.rotation.z = Math.PI * 0.075 + Math.PI * 1.5;
      ban.rotation.x = Math.PI / 2;
      ban.position.y = 1.75;
      const tipA = cone(0.3, 0.6, "#7a5230");
      tipA.rotation.x = -Math.PI / 2;
      tipA.position.set(0, 0.72, 1.85);
      const tipB = cone(0.3, 0.6, "#7a5230");
      tipB.rotation.x = Math.PI / 2;
      tipB.position.set(0, 0.72, -1.85);
      body.add(ban, tipA, tipB);
      wheelS = 0.4;
      break;
    }
    case "rubber-duck": {
      const bod = sph(1.05, "#ffd23f");
      bod.scale.set(1.1, 0.85, 1.25);
      bod.position.y = 1.05;
      const head = sph(0.6, "#ffd23f");
      head.position.set(0, 1.85, 1.0);
      const beak = cone(0.22, 0.45, "#ff7f2a");
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 1.8, 1.6);
      const eyeL = sph(0.09, "#16181d");
      eyeL.position.set(0.25, 2.05, 1.45);
      const eyeR = eyeL.clone();
      eyeR.position.x = -0.25;
      const tail = cone(0.3, 0.55, "#ffd23f");
      tail.rotation.x = -Math.PI / 2.4;
      tail.position.set(0, 1.3, -1.45);
      body.add(bod, head, beak, eyeL, eyeR, tail);
      wheelS = 0.34;
      break;
    }
    case "monster-truck": {
      const chassis = box(2.4, 0.7, 3.4, paint);
      chassis.position.y = 1.5;
      const cab = box(1.9, 0.85, 1.6, paint);
      cab.position.set(0, 2.25, -0.2);
      const windowM = box(1.7, 0.5, 0.1, "#bfe8ef");
      windowM.position.set(0, 2.3, 0.65);
      const rollL = box(0.12, 0.9, 0.12, "#21293c");
      rollL.position.set(-0.85, 2.9, -1.3);
      const rollR = rollL.clone();
      rollR.position.x = 0.85;
      const rollBar = box(1.82, 0.12, 0.12, "#21293c");
      rollBar.position.set(0, 3.35, -1.3);
      const bumper = box(2.6, 0.35, 0.3, "#21293c");
      bumper.position.set(0, 1.25, 1.85);
      body.add(chassis, cab, windowM, rollL, rollR, rollBar, bumper);
      wheelS = 0.78;
      break;
    }
    case "flying-carpet": {
      const carpet = box(2.2, 0.14, 3.2, paint);
      carpet.position.y = 0.75;
      const trimF = box(2.24, 0.16, 0.3, "#ffd23f");
      trimF.position.set(0, 0.75, 1.45);
      const trimB = trimF.clone();
      trimB.position.z = -1.45;
      const pillow = sph(0.55, "#ff5ca8");
      pillow.scale.set(1, 0.5, 0.8);
      pillow.position.set(0, 0.95, -0.6);
      for (const [x, z] of [[-1, 1.55], [1, 1.55], [-1, -1.55], [1, -1.55]] as const) {
        const tass = cone(0.12, 0.4, "#ffd23f");
        tass.position.set(x, 0.55, z);
        tass.rotation.x = Math.PI;
        body.add(tass);
      }
      body.add(carpet, trimF, trimB, pillow);
      wheelS = 0;
      break;
    }
    case "mini-tank": {
      const hull = box(2.5, 0.8, 3.3, paint);
      hull.position.y = 0.9;
      const hullTop = box(2.1, 0.5, 2.4, paint);
      hullTop.rotation.x = 0.06;
      hullTop.position.y = 1.5;
      const turret = cyl(0.95, 1.05, 0.65, paint, 14);
      turret.position.y = 1.95;
      const hatch = cyl(0.4, 0.4, 0.2, "#21293c");
      hatch.position.y = 2.35;
      const barrel = cyl(0.14, 0.16, 2.2, "#21293c");
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 1.95, 1.9);
      const treadL = box(0.55, 0.85, 3.5, "#2f3632");
      treadL.position.set(-1.15, 0.5, 0);
      const treadR = treadL.clone();
      treadR.position.x = 1.15;
      body.add(hull, hullTop, turret, hatch, barrel, treadL, treadR);
      wheelS = 0.3;
      break;
    }
    case "skateboard": {
      const deck = box(1.3, 0.16, 3.1, paint);
      deck.position.y = 0.52;
      const noseA = box(1.3, 0.16, 0.5, paint);
      noseA.rotation.x = 0.4;
      noseA.position.set(0, 0.62, 1.7);
      const noseB = box(1.3, 0.16, 0.5, paint);
      noseB.rotation.x = -0.4;
      noseB.position.set(0, 0.62, -1.7);
      const grip = box(1.2, 0.04, 2.9, "#21293c");
      grip.position.y = 0.61;
      const truckA = box(1.3, 0.14, 0.14, "#c8ccd4");
      truckA.position.set(0, 0.42, 1.15);
      const truckB = truckA.clone();
      truckB.position.z = -1.15;
      body.add(deck, noseA, noseB, grip, truckA, truckB);
      wheelS = 0.3;
      break;
    }
    case "lawn-mower": {
      const chassis = box(2.1, 0.5, 2.5, paint);
      chassis.position.y = 0.75;
      const deckM = box(2.4, 0.4, 1.3, "#5a7d5a");
      deckM.position.set(0, 0.45, 0.95);
      const engine = box(1.1, 0.8, 1, "#44484f");
      engine.position.set(0, 1.35, -0.3);
      const pipe = cyl(0.14, 0.14, 0.8, "#21293c");
      pipe.position.set(0.45, 1.95, -0.3);
      const seat = box(0.8, 0.18, 0.75, "#8b2e2e");
      seat.position.set(0, 1.15, -1.05);
      const seatBack = box(0.8, 0.7, 0.16, "#8b2e2e");
      seatBack.position.set(0, 1.5, -1.42);
      const bar = box(1.1, 0.09, 0.09, "#21293c");
      bar.position.set(0, 1.75, 0.5);
      const grass = cyl(0.9, 0.9, 0.12, "#3ddc84", 10);
      grass.position.set(0, 0.3, 0.95);
      body.add(chassis, deckM, engine, pipe, seat, seatBack, bar, grass);
      wheelS = 0.42;
      break;
    }
    case "toaster-turbo": {
      const shell = box(2.1, 1.5, 2.6, paint);
      shell.position.y = 1.15;
      const slotA = box(0.55, 0.12, 1.7, "#21293c");
      slotA.position.set(-0.45, 1.92, 0);
      const slotB = slotA.clone();
      slotB.position.x = 0.45;
      const toastA = box(0.5, 0.75, 0.7, "#d9a441");
      toastA.position.set(-0.45, 2.3, 0);
      const toastB = toastA.clone();
      toastB.position.x = 0.45;
      const lever = box(0.16, 0.5, 0.16, "#e63946");
      lever.position.set(1.12, 1.6, 0.7);
      const dial = cyl(0.26, 0.26, 0.1, "#ffd23f", 10);
      dial.rotation.x = Math.PI / 2;
      dial.position.set(0, 1, 1.33);
      body.add(shell, slotA, slotB, toastA, toastB, lever, dial);
      wheelS = 0.36;
      break;
    }
    case "coffee-cruiser": {
      const cup = cyl(1.15, 0.78, 2, "#f5f9ff", 16);
      cup.position.y = 1.15;
      const sleeve = cyl(1.03, 0.92, 0.8, paint, 16);
      sleeve.position.y = 1.1;
      const lid = cyl(1.2, 1.2, 0.18, "#44484f", 16);
      lid.position.y = 2.2;
      const sip = cyl(0.22, 0.22, 0.2, "#21293c", 8);
      sip.position.set(0, 2.32, 0.7);
      const handle = tor(0.5, 0.13, "#f5f9ff", Math.PI * 1.2);
      handle.rotation.y = Math.PI / 2;
      handle.position.set(-1.15, 1.2, 0);
      const steam = sph(0.22, "#ffffff", 8, { transparent: true, opacity: 0.5 });
      steam.position.set(0, 2.9, 0.2);
      const steam2 = sph(0.17, "#ffffff", 8, { transparent: true, opacity: 0.4 });
      steam2.position.set(0.3, 3.3, 0);
      body.add(cup, sleeve, lid, sip, handle, steam, steam2);
      wheelS = 0.36;
      break;
    }
    case "ice-cream-truck": {
      const boxy = box(2.4, 1.5, 3.6, paint);
      boxy.position.y = 1.5;
      const cab = box(2.2, 1, 1.1, "#f5f9ff");
      cab.position.set(0, 1.3, 2);
      const windshield = box(2, 0.6, 0.12, "#bfe8ef");
      windshield.position.set(0, 1.5, 2.57);
      const window2 = box(1.5, 0.7, 0.1, "#bfe8ef");
      window2.position.set(1.22, 1.7, 0.2);
      window2.rotation.y = Math.PI / 2;
      const coneTop = cone(0.55, 1.2, "#ff9de2");
      coneTop.position.set(0, 3.2, -0.3);
      const scoop = sph(0.45, "#fff0f8");
      scoop.position.set(0, 3.85, -0.3);
      const cherry = sph(0.18, "#e63946");
      cherry.position.set(0, 4.25, -0.3);
      const stripe = box(2.45, 0.3, 3.65, "#ffd23f");
      stripe.position.y = 1.05;
      body.add(boxy, cab, windshield, window2, coneTop, scoop, cherry, stripe);
      wheelS = 0.48;
      break;
    }
    case "hot-air-kart": {
      const basket = box(1.7, 1, 1.9, "#b5824f");
      basket.position.y = 0.95;
      for (let i = 0; i < 4; i++) {
        const rope = cyl(0.05, 0.05, 2.2, "#e8d5a8");
        const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
        rope.position.set(Math.cos(ang) * 0.75, 2.5, Math.sin(ang) * 0.85);
        body.add(rope);
      }
      const balloon = sph(1.9, paint, 16);
      balloon.scale.y = 1.25;
      balloon.position.y = 5.1;
      const bandA = tor(1.9, 0.14, "#ffd23f");
      bandA.rotation.y = Math.PI / 2;
      bandA.position.y = 5.1;
      const bandB = tor(1.9, 0.14, "#ff5ca8");
      bandB.position.y = 5.1;
      const burner = cyl(0.3, 0.4, 0.45, "#c8ccd4");
      burner.position.y = 3.45;
      const flameB = cone(0.25, 0.6, "#ff7f2a", 8, { emissive: "#ff4d00" });
      flameB.position.y = 3.15;
      flameB.rotation.x = Math.PI;
      body.add(basket, balloon, bandA, bandB, burner, flameB);
      wheelS = 0.3;
      break;
    }
    case "submarine": {
      const hull = cyl(0.95, 0.95, 3.4, paint, 16);
      hull.rotation.x = Math.PI / 2;
      hull.position.y = 1.1;
      const nose = sph(0.95, paint);
      nose.position.set(0, 1.1, 1.7);
      const tailS = cone(0.9, 1.1, paint);
      tailS.rotation.x = -Math.PI / 2;
      tailS.position.set(0, 1.1, -2.1);
      const tower = box(0.8, 0.9, 1.2, "#21456b");
      tower.position.set(0, 2.1, -0.2);
      const peri = cyl(0.09, 0.09, 0.9, "#c8ccd4");
      peri.position.set(0, 2.9, -0.4);
      const periTop = box(0.26, 0.14, 0.3, "#c8ccd4");
      periTop.position.set(0, 3.3, -0.25);
      const portA = cyl(0.26, 0.26, 0.1, "#bfe8ef", 10, { emissive: "#2d6a8f" });
      portA.rotation.z = Math.PI / 2;
      portA.position.set(0.93, 1.25, 0.5);
      const portB = portA.clone();
      portB.position.x = -0.93;
      const finS = box(0.12, 0.8, 0.7, "#21456b");
      finS.position.set(0, 1.5, -2.2);
      const propS = tor(0.4, 0.1, "#ffd23f");
      propS.position.set(0, 1.1, -2.65);
      body.add(hull, nose, tailS, tower, peri, periTop, portA, portB, finS, propS);
      wheelS = 0.36;
      break;
    }
    case "dino-stomper": {
      const bodyD = sph(1.3, paint);
      bodyD.scale.set(1, 1, 1.5);
      bodyD.position.y = 1.5;
      const neck = cyl(0.45, 0.6, 1.3, paint);
      neck.rotation.x = 0.4;
      neck.position.set(0, 2.4, 0.9);
      const headD = box(0.85, 0.8, 1.4, paint);
      headD.position.set(0, 3.05, 1.6);
      const jaw = box(0.8, 0.3, 1.2, "#2a9d6a");
      jaw.position.set(0, 2.65, 1.7);
      for (let i = 0; i < 4; i++) {
        const tooth = cone(0.08, 0.22, "#ffffff");
        tooth.rotation.x = Math.PI;
        tooth.position.set(-0.28 + i * 0.19, 2.86, 1.45 + (i % 2) * 0.35);
        body.add(tooth);
      }
      const eyeD = sph(0.14, "#16181d");
      eyeD.position.set(0.38, 3.3, 1.9);
      const eyeD2 = eyeD.clone();
      eyeD2.position.x = -0.38;
      const tailD = cone(0.65, 2.3, paint);
      tailD.rotation.x = -Math.PI / 2 - 0.25;
      tailD.position.set(0, 1.5, -2.2);
      for (let i = 0; i < 5; i++) {
        const plate = cone(0.26, 0.5, "#ffd23f");
        plate.position.set(0, 2.5 + Math.sin(i) * 0.1, 0.4 - i * 0.6);
        body.add(plate);
      }
      body.add(bodyD, neck, headD, jaw, eyeD, eyeD2, tailD);
      wheelS = 0.62;
      break;
    }
    case "ufo-saucer": {
      const dish = sph(1.9, "#c8ccd4", 18);
      dish.scale.y = 0.3;
      dish.position.y = 1.15;
      const rim = tor(1.72, 0.22, paint);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 1.15;
      const dome = sph(0.95, "#9bf0ff", 14, { transparent: true, opacity: 0.55 });
      dome.position.y = 1.65;
      const base = cyl(1.3, 1.6, 0.4, "#8d97a3", 18);
      base.position.y = 0.85;
      for (let i = 0; i < 8; i++) {
        const lamp = sph(0.17, "#64ffda", 8, { emissive: "#1b998b" });
        const a = (i / 8) * Math.PI * 2;
        lamp.position.set(Math.cos(a) * 1.5, 0.78, Math.sin(a) * 1.5);
        body.add(lamp);
      }
      const beam = cone(0.9, 1.1, "#64ffda", 12, { transparent: true, opacity: 0.22 });
      beam.position.y = 0.2;
      beam.rotation.x = Math.PI;
      body.add(dish, rim, dome, base, beam);
      wheelS = 0.3;
      break;
    }
    case "golden-chariot": {
      const tub = cyl(1.1, 0.95, 1.3, "#ffd700", 16);
      tub.scale.z = 1.35;
      tub.position.y = 1.15;
      const rimG = tor(1.08, 0.14, "#fff3b0");
      rimG.rotation.x = Math.PI / 2;
      rimG.scale.y = 1.35;
      rimG.position.y = 1.8;
      const front = box(1.9, 1.2, 0.2, "#ffd700");
      front.position.set(0, 1.35, 1.5);
      const crest = cone(0.42, 0.85, "#fff3b0");
      crest.position.set(0, 2.25, 1.5);
      const shaft = box(0.16, 0.16, 2.6, "#c9a227");
      shaft.position.set(0, 0.95, 2.6);
      const yoke = box(1.5, 0.16, 0.16, "#c9a227");
      yoke.position.set(0, 0.95, 3.7);
      const wingL = box(0.12, 0.8, 1.1, "#fff3b0");
      wingL.rotation.x = 0.3;
      wingL.position.set(1.05, 1.7, -0.3);
      const wingR = wingL.clone();
      wingR.position.x = -1.05;
      const laurel = tor(0.5, 0.1, "#3ddc84");
      laurel.position.set(0, 1.6, -1.65);
      body.add(tub, rimG, front, crest, shaft, yoke, wingL, wingR, laurel);
      wheelS = 0.56;
      break;
    }
    default: {
      const b = box(1.8, 0.6, 3, paint);
      b.position.y = 0.9;
      body.add(b);
    }
  }

  // wheels
  if (wheelS > 0) {
    const wy = wheelS * (wheelStyle === "monster" ? 1.4 : 1);
    const ws = wheelStyle === "monster" ? wheelS * 1.4 : wheelS;
    if (veh.id === "monster-truck" || veh.id === "ice-cream-truck" || veh.id === "dino-stomper") {
      addWheel(-1.35, wy, 1.45, ws); addWheel(1.35, wy, 1.45, ws);
      addWheel(-1.35, wy, -1.45, ws); addWheel(1.35, wy, -1.45, ws);
    } else if (veh.id === "chicken-bike") {
      addWheel(0, wy, 1.35, ws); addWheel(0, wy, -1.35, ws);
    } else if (veh.id === "mini-tank") {
      // treads only - tiny hidden wheels for effect
      addWheel(-1.16, 0.3, 1.1, 0.3); addWheel(1.16, 0.3, 1.1, 0.3);
      addWheel(-1.16, 0.3, -1.1, 0.3); addWheel(1.16, 0.3, -1.1, 0.3);
    } else {
      addWheel(-0.85, wy, 1.25, ws); addWheel(0.85, wy, 1.25, ws);
      addWheel(-0.85, wy, -1.25, ws); addWheel(0.85, wy, -1.25, ws);
    }
  }

  // boost flame (hidden unless boosting)
  const flame = new THREE.Group();
  const f1 = cone(0.34, 1.3, "#ff7f2a");
  f1.rotation.x = Math.PI / 2;
  const f2 = cone(0.2, 0.9, "#ffd23f");
  f2.rotation.x = Math.PI / 2;
  f2.position.z = -0.15;
  flame.add(f1, f2);
  flame.position.set(0, 0.85, -2.1);
  flame.visible = false;
  group.add(flame);

  body.userData.baseY = body.position.y;
  group.add(body);
  return { group, wheels, driver: new THREE.Group(), driverParts: {}, flame, body };
}

// ============================================================================
// DRIVER CHARACTER
// ============================================================================
export function buildDriver(char: CharacterDef, hatId: string): { group: THREE.Group; parts: BuiltKart["driverParts"] } {
  const g = new THREE.Group();
  const body = box(0.72, 0.78, 0.5, char.shirt);
  body.position.y = 1.15;
  const pantsM = box(0.72, 0.3, 0.55, char.pants);
  pantsM.position.y = 0.68;
  const head = new THREE.Group();
  const skull = sph(0.42, char.skin);
  const hairM = sph(0.45, char.hair);
  hairM.scale.y = 0.62;
  hairM.position.y = 0.16;
  const eyeL = sph(0.075, "#16181d");
  eyeL.position.set(0.16, 0.06, 0.37);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.16;
  const nose = sph(0.08, char.skin);
  nose.position.set(0, -0.04, 0.42);
  const mouth = box(0.2, 0.05, 0.04, "#8d3030");
  mouth.position.set(0, -0.18, 0.4);
  head.add(skull, hairM, eyeL, eyeR, nose, mouth);
  // hat
  buildHat(hatId, head);
  head.position.y = 1.95;

  const armL = new THREE.Group();
  const armLM = cyl(0.11, 0.1, 0.7, char.shirt);
  armLM.position.y = -0.32;
  const handL = sph(0.13, char.skin);
  handL.position.y = -0.7;
  armL.add(armLM, handL);
  armL.position.set(-0.46, 1.5, 0);
  armL.rotation.x = -1.0;
  const armR = armL.clone();
  armR.position.x = 0.46;

  g.add(body, pantsM, head, armL, armR);
  return { group: g, parts: { head, armL, armR, body } };
}

function buildHat(hatId: string, head: THREE.Group) {
  switch (hatId) {
    case "cowboy": {
      const brim = cyl(0.62, 0.62, 0.07, "#8b5a2b");
      brim.position.y = 0.26;
      const top = cyl(0.34, 0.38, 0.34, "#8b5a2b");
      top.position.y = 0.44;
      head.add(brim, top);
      break;
    }
    case "party": {
      const c = cone(0.3, 0.6, "#ff5ca8");
      c.position.y = 0.55;
      const pom = sph(0.1, "#ffffff");
      pom.position.y = 0.88;
      head.add(c, pom);
      break;
    }
    case "cone": {
      const c = cone(0.34, 0.7, "#ff7f2a");
      c.position.y = 0.6;
      const stripe = cyl(0.31, 0.33, 0.1, "#ffffff");
      stripe.position.y = 0.5;
      head.add(c, stripe);
      break;
    }
    case "crown": {
      const base = cyl(0.38, 0.38, 0.2, "#ffd700");
      base.position.y = 0.42;
      head.add(base);
      for (let i = 0; i < 5; i++) {
        const spike = cone(0.09, 0.26, "#ffd700");
        const a = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.32, 0.6, Math.sin(a) * 0.32);
        head.add(spike);
      }
      break;
    }
    case "pan": {
      const pan = cyl(0.45, 0.42, 0.12, "#44484f");
      pan.position.y = 0.36;
      const handle = box(0.1, 0.08, 0.6, "#44484f");
      handle.position.set(0.62, 0.36, 0);
      head.add(pan, handle);
      break;
    }
    case "propeller": {
      const capM = sph(0.43, "#ff4d4d");
      capM.scale.y = 0.55;
      capM.position.y = 0.18;
      const stem = cyl(0.04, 0.04, 0.3, "#21293c");
      stem.position.y = 0.55;
      const blade = box(0.85, 0.05, 0.14, "#ffd23f");
      blade.position.y = 0.72;
      head.add(capM, stem, blade);
      break;
    }
    case "duck-hat": {
      const duck = sph(0.3, "#ffd23f");
      duck.position.y = 0.45;
      const beak = cone(0.09, 0.2, "#ff7f2a");
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.44, 0.34);
      head.add(duck, beak);
      break;
    }
    case "viking": {
      const dome = sph(0.44, "#c8ccd4");
      dome.scale.y = 0.6;
      dome.position.y = 0.24;
      const hornL = cone(0.09, 0.34, "#f5f5f5");
      hornL.rotation.z = 1.2;
      hornL.position.set(-0.45, 0.4, 0);
      const hornR = hornL.clone();
      hornR.rotation.z = -1.2;
      hornR.position.x = 0.45;
      head.add(dome, hornL, hornR);
      break;
    }
    default:
      break;
  }
}

// ============================================================================
// ITEM / HAZARD BUILDERS
// ============================================================================
export function buildPickupBox(): THREE.Group {
  const g = new THREE.Group();
  const b = box(1.1, 1.1, 1.1, "#64ffda", { emissive: "#1b998b" });
  const q1 = box(0.5, 0.14, 0.06, "#16181d");
  q1.position.set(0.12, 0.14, 0.56);
  const qd = sph(0.1, "#16181d");
  qd.position.set(0, -0.3, 0.56);
  const q2 = q1.clone();
  q2.position.z = -0.56;
  const qd2 = qd.clone();
  qd2.position.z = -0.56;
  g.add(b, q1, qd, q2, qd2);
  g.position.y = 1.2;
  return g;
}

export function buildCoinMesh(): THREE.Group {
  const c = tor(0.5, 0.16, "#ffd700", Math.PI * 2, { emissive: "#7a5c00" });
  const inner = cyl(0.42, 0.42, 0.1, "#ffe066", 12, { emissive: "#7a5c00" });
  inner.rotation.x = Math.PI / 2;
  const g = new THREE.Group();
  g.add(c, inner);
  return g;
}

export function buildBananaMesh(): THREE.Group {
  const g = new THREE.Group();
  const b = tor(0.5, 0.16, "#ffd23f", Math.PI * 0.8);
  b.rotation.x = Math.PI / 2;
  b.position.y = 0.2;
  const tipA = sph(0.09, "#7a5230");
  tipA.position.set(0.5, 0.2, 0.12);
  const tipB = sph(0.09, "#7a5230");
  tipB.position.set(-0.5, 0.2, 0.12);
  g.add(b, tipA, tipB);
  return g;
}

export function buildEggMesh(): THREE.Group {
  const g = new THREE.Group();
  const e = sph(0.4, "#fbf3df");
  e.scale.y = 1.3;
  e.position.y = 0.45;
  g.add(e);
  return g;
}

export function buildChickenMesh(): THREE.Group {
  const g = new THREE.Group();
  const bod = sph(0.5, "#fbf3df");
  const head = sph(0.3, "#fbf3df");
  head.position.set(0, 0.42, 0.42);
  const beak = cone(0.09, 0.2, "#ff7f2a");
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.4, 0.72);
  const comb = box(0.08, 0.2, 0.25, "#e63946");
  comb.position.set(0, 0.72, 0.4);
  const wingL = box(0.08, 0.35, 0.45, "#f0e2c8");
  wingL.position.set(-0.5, 0, 0);
  const wingR = wingL.clone();
  wingR.position.x = 0.5;
  const tail = cone(0.16, 0.4, "#e63946");
  tail.rotation.x = Math.PI / 2 + 0.5;
  tail.position.set(0, 0.25, -0.52);
  g.add(bod, head, beak, comb, wingL, wingR, tail);
  g.userData = { wingL, wingR };
  return g;
}

export function buildShieldBubble(): THREE.Mesh {
  const s = sph(2.3, "#66e0ff", 18, { transparent: true, opacity: 0.22 });
  s.castShadow = false;
  return s;
}

export function buildGloveMesh(): THREE.Group {
  const g = new THREE.Group();
  const fist = sph(0.85, "#ff4d6d");
  const thumb = sph(0.3, "#ff4d6d");
  thumb.position.set(0.5, -0.15, 0.3);
  const cuff = cyl(0.45, 0.5, 0.4, "#f5f5f5");
  cuff.rotation.x = Math.PI / 2;
  cuff.position.z = -0.85;
  const spring = cyl(0.12, 0.12, 4.2, "#9fb4c7");
  spring.rotation.x = Math.PI / 2;
  spring.position.z = -3.1;
  g.add(fist, thumb, cuff, spring);
  return g;
}

export function buildIceBlock(): THREE.Mesh {
  const b = box(2.6, 2.6, 3.4, "#9bf0ff", { transparent: true, opacity: 0.5 });
  b.castShadow = false;
  return b;
}
