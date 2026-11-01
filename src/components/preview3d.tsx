"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { VEHICLES, CHARACTERS } from "@/game/data";
import { buildKart, buildDriver } from "@/game/builders";

// Tiny turntable 3D preview used by the Garage / Characters screens.
export default function Preview3D({
  kind,
  vehId,
  charId,
  paint,
  wheels,
  hat,
}: {
  kind: "kart" | "char";
  vehId: string;
  charId: string;
  paint: string;
  wheels: string;
  hat: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    cam.position.set(4.6, 3.2, 6.4);
    cam.lookAt(0, 1.1, 0);
    const hemi = new THREE.HemisphereLight("#ffffff", "#8b5cf6", 1.5);
    const dir = new THREE.DirectionalLight("#fff2d9", 1.6);
    dir.position.set(4, 8, 5);
    scene.add(hemi, dir);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.6, 0.3, 40),
      new THREE.MeshLambertMaterial({ color: "#ffd23f" }),
    );
    disc.position.y = -0.15;
    scene.add(disc);

    const holder = new THREE.Group();
    if (kind === "kart") {
      const veh = VEHICLES.find((v) => v.id === vehId) ?? VEHICLES[0];
      const kart = buildKart(veh, paint, wheels);
      const char = CHARACTERS.find((c) => c.id === charId) ?? CHARACTERS[0];
      const driver = buildDriver(char, hat);
      driver.group.position.set(0, 0.35, 0.1);
      kart.group.add(driver.group);
      holder.add(kart.group);
    } else {
      const char = CHARACTERS.find((c) => c.id === charId) ?? CHARACTERS[0];
      const driver = buildDriver(char, hat);
      driver.group.position.y = 0;
      driver.group.scale.setScalar(1.35);
      holder.add(driver.group);
    }
    scene.add(holder);

    const size = () => {
      const w = canvas.clientWidth || 280;
      const h = canvas.clientHeight || 220;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    let raf = 0;
    let t = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      holder.rotation.y = t * 1.1;
      holder.position.y = Math.sin(t * 2.2) * 0.08;
      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    };
  }, [kind, vehId, charId, paint, wheels, hat]);

  return <canvas ref={ref} className="h-full w-full" />;
}
