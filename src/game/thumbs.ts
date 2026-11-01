// ============================================================================
// Car "photos": renders each vehicle's real 3D model once on a single shared
// offscreen WebGLRenderer and caches the data URL. Nothing is downloaded.
// ============================================================================

"use client";

import * as THREE from "three";
import { buildKart, buildDriver } from "./builders";
import { vehicleById, RARITY_COLOR, type Rarity } from "./data";
import { CHARACTERS, cosmeticById } from "./data";

export interface ThumbOpts {
  paint?: string;
  wheels?: string;
  withDriver?: boolean;
  charId?: string;
  hat?: string;
}

const SIZE = 320;
const FALLBACK =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null | undefined; // undefined = not tried yet
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let rig: THREE.Group | null = null;

function ensureRig(): boolean {
  if (renderer !== undefined) return !!renderer;
  if (typeof document === "undefined") { renderer = null; return false; }
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setSize(SIZE, SIZE);
    renderer.setPixelRatio(1);
    scene = new THREE.Scene();
    scene.background = null;
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(4.6, 3.4, 5.4);
    camera.lookAt(0, 0.9, 0);
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(4, 6, 3);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 1.2);
    fill.position.set(-5, 3, -2);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x554477, 1.4);
    rig = new THREE.Group();
    scene.add(key, fill, hemi, rig);
    return true;
  } catch {
    renderer = null;
    return false;
  }
}

/** Render (and cache) a thumbnail of a vehicle. Returns a data URL. */
export function carThumb(vehId: string, opts: ThumbOpts = {}): string {
  const key = JSON.stringify([vehId, opts.paint ?? null, opts.wheels ?? null, opts.withDriver ?? true, opts.charId ?? null, opts.hat ?? null]);
  const hit = cache.get(key);
  if (hit) return hit;
  if (!ensureRig() || !renderer || !scene || !camera || !rig) return FALLBACK;

  const veh = vehicleById(vehId);
  // clear previous
  while (rig.children.length) {
    const c = rig.children.pop()!;
    rig.remove(c);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
  const kart = buildKart(veh, opts.paint ?? veh.paint, opts.wheels ?? "classic");
  rig.add(kart.group);
  if (opts.withDriver !== false) {
    const ch = cosmeticById(CHARACTERS, opts.charId ?? "cappy");
    const driver = buildDriver(ch, opts.hat ?? "none");
    driver.group.position.set(0, 0.55, -0.15);
    driver.group.scale.setScalar(1.15);
    kart.group.add(driver.group);
  }
  rig.rotation.y = -0.55;
  renderer.render(scene, camera);
  let url = FALLBACK;
  try {
    url = renderer.domElement.toDataURL("image/png");
  } catch {
    url = FALLBACK;
  }
  cache.set(key, url);
  if (cache.size > 80) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return url;
}

/** CSS gradient backdrop per rarity. */
export function rarityBackdrop(vehId: string): string {
  const veh = vehicleById(vehId);
  const c = RARITY_COLOR[veh.rarity as Rarity];
  const soft = veh.rarity === "legendary"
    ? "radial-gradient(120% 120% at 50% 0%, #ffd23f55 0%, transparent 60%)"
    : veh.rarity === "epic"
      ? "radial-gradient(120% 120% at 50% 0%, #8b5cf655 0%, transparent 60%)"
      : veh.rarity === "rare"
        ? "radial-gradient(120% 120% at 50% 0%, #2dd4c855 0%, transparent 60%)"
        : "radial-gradient(120% 120% at 50% 0%, #9aa7b840 0%, transparent 60%)";
  return `${soft}, linear-gradient(180deg, #fffdf8 0%, ${c}22 100%)`;
}
