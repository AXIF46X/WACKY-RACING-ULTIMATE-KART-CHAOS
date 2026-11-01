"use client";

// Turntable 3D preview of a kart (+driver) for the garage / characters screens.
// Built from the same procedural builders as the in-game model.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildKart, buildDriver } from "@/game/builders";
import { vehicleById, cosmeticById, CHARACTERS } from "@/game/data";

export default function Preview3D({
  vehicleId,
  paint,
  wheelsId = "classic",
  charId = "cappy",
  hatId = "none",
  withDriver = true,
  size = 220,
  className = "",
}: {
  vehicleId: string;
  paint?: string;
  wheelsId?: string;
  charId?: string;
  hatId?: string;
  withDriver?: boolean;
  size?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(4.4, 3.1, 5.2);
    camera.lookAt(0, 0.8, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x554477, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4, 7, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 1.1);
    fill.position.set(-5, 3, -3);
    scene.add(fill);

    const rig = new THREE.Group();
    scene.add(rig);
    const veh = vehicleById(vehicleId);
    const kart = buildKart(veh, paint ?? veh.paint, wheelsId);
    rig.add(kart.group);
    if (withDriver) {
      const driver = buildDriver(cosmeticById(CHARACTERS, charId), hatId);
      driver.group.position.set(0, 0.55, -0.15);
      kart.group.add(driver.group);
    }

    let raf = 0;
    let last = performance.now();
    const spin = (t: number) => {
      raf = requestAnimationFrame(spin);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      rig.rotation.y += dt * 0.9;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(spin);

    return () => {
      cancelAnimationFrame(raf);
      rig.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        }
      });
      renderer.dispose();
    };
  }, [vehicleId, paint, wheelsId, charId, hatId, withDriver, size]);

  return <canvas ref={ref} className={className} style={{ width: size, height: size }} />;
}
