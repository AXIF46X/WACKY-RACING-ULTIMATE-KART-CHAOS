// ============================================================================
// WACKY RACING — car "photos" rendered from the real 3D models.
// One shared offscreen WebGL renderer snapshots each kart once and caches the
// PNG data URL, so grids of 20 cars cost a single renderer and zero downloads.
// ============================================================================
import * as THREE from "three";
import { VEHICLES, CHARACTERS, RARITY_META, type VehicleDef } from "./data";
import { buildKart, buildDriver } from "./builders";

const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let canvas: HTMLCanvasElement | null = null;

const SIZE = 320;

function getRenderer(): THREE.WebGLRenderer | null {
  if (typeof window === "undefined") return null;
  if (renderer) return renderer;
  try {
    canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
  } catch {
    return null;
  }
  return renderer;
}

export interface ThumbOpts {
  paint?: string;
  wheels?: string;
  withDriver?: boolean;
  charId?: string;
  hat?: string;
}

/**
 * Returns a cached data-URL "photo" of a car, rendered from its 3D model.
 * Safe to call during render; returns null on the server or if WebGL is absent.
 */
export function carThumb(vehId: string, opts: ThumbOpts = {}): string | null {
  const veh: VehicleDef | undefined = VEHICLES.find((v) => v.id === vehId);
  if (!veh) return null;
  const paint = opts.paint ?? veh.color;
  const wheels = opts.wheels ?? "classic";
  const key = `${vehId}|${paint}|${wheels}|${opts.withDriver ? opts.charId ?? "c" : "-"}|${opts.hat ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const r = getRenderer();
  if (!r) return null;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 200);

  // soft three-point-ish cartoon lighting
  scene.add(new THREE.HemisphereLight("#ffffff", "#a98bd8", 1.45));
  const key1 = new THREE.DirectionalLight("#fff3dd", 1.5);
  key1.position.set(6, 9, 7);
  const fill = new THREE.DirectionalLight("#b9e6ff", 0.55);
  fill.position.set(-7, 4, -3);
  scene.add(key1, fill);

  const holder = new THREE.Group();
  const kart = buildKart(veh, paint, wheels);
  if (opts.withDriver) {
    const d = buildDriver(
      CHARACTERS.find((c) => c.id === opts.charId) ?? CHARACTERS[0],
      opts.hat ?? "none",
    );
    d.group.position.set(0, 0.35, 0.1);
    kart.group.add(d.group);
  }
  holder.add(kart.group);
  // three-quarter "showroom" angle
  holder.rotation.y = -Math.PI * 0.72;
  scene.add(holder);

  // frame the car automatically so big and small karts both fill the shot
  const bbox = new THREE.Box3().setFromObject(holder);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 2;
  const dist = radius / Math.sin((cam.fov * Math.PI) / 360) * 1.12;
  cam.position.set(center.x + dist * 0.62, center.y + dist * 0.5, center.z + dist * 0.72);
  cam.lookAt(center);
  cam.updateProjectionMatrix();

  let url: string;
  try {
    r.setClearColor(0x000000, 0);
    r.render(scene, cam);
    url = r.domElement.toDataURL("image/png");
  } catch {
    return null;
  } finally {
    // free GPU/CPU memory for this one-shot scene
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }

  cache.set(key, url);
  return url;
}

/** Background gradient matching a car's rarity, for card backdrops. */
export function rarityBackdrop(vehId: string): string {
  const v = VEHICLES.find((x) => x.id === vehId);
  if (!v) return "linear-gradient(135deg,#eee,#fff)";
  const m = RARITY_META[v.rarity];
  return `radial-gradient(circle at 50% 120%, ${v.color}55, transparent 60%), linear-gradient(140deg, ${m.glow}, #ffffff)`;
}
