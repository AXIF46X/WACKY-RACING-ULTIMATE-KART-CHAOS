"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pause, Play, RotateCcw, Home, Coins, Timer, Flag, Zap, Snowflake,
  ArrowLeftRight, ShieldCheck, ChevronsUp, ChevronLeft, ChevronRight, OctagonAlert,
} from "lucide-react";
import { WackyEngine } from "@/game/engine";
import { TRACKS, fmtTime, POWERUPS } from "@/game/data";
import { AudioMan } from "@/game/audio";
import { useApp, useHud, type RaceSummary } from "@/lib/store";
import { PowerIcon } from "@/components/menus";

export default function RaceScreen({
  onFinish,
  onQuit,
  onRestart,
}: {
  onFinish: (s: RaceSummary) => void;
  onQuit: () => void;
  onRestart: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WackyEngine | null>(null);
  const setup = useApp((s) => s.setup);
  const garage = useApp((s) => s.garage);
  const settings = useApp((s) => s.settings);
  const profile = useApp((s) => s.profile);
  void profile;
  const raceKey = useApp((s) => s.raceKey);
  const [paused, setPaused] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTouch(typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window));
  }, []);

  // gyro tilt steering (mobile, opt-in via Settings → Controls)
  const tiltOn = settings.tilt;
  useEffect(() => {
    if (!tiltOn) {
      engineRef.current?.setTilt(0);
      return;
    }
    const handler = (e: DeviceOrientationEvent) => {
      const landscape = window.innerWidth > window.innerHeight;
      // landscape: gamma (left/right roll) steers; portrait held upright: roll of beta around natural pose
      const raw = landscape ? (e.gamma ?? 0) : (e.gamma ?? 0);
      const steer = Math.max(-1, Math.min(1, raw / 24));
      engineRef.current?.setTilt(steer);
    };
    window.addEventListener("deviceorientation", handler);
    return () => {
      window.removeEventListener("deviceorientation", handler);
      engineRef.current?.setTilt(0);
    };
  }, [tiltOn, raceKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    AudioMan.ensure();
    AudioMan.setMusicOn(useApp.getState().settings.music);
    AudioMan.setSfxOn(useApp.getState().settings.sfx);
    const st = useApp.getState();
    const engine = new WackyEngine({
      canvas,
      setup: st.setup,
      garage: st.garage,
      playerName: st.profile?.name ?? "Racer",
      settings: { quality: st.settings.quality, shake: st.settings.shake },
      controls: { keys: { ...st.settings.keys }, sensitivity: st.settings.sensitivity },
      upgrades: st.profile?.upgrades ?? {},
      onFinish: (summary) => {
        engineRef.current = null;
        onFinish(summary);
      },
      onQuit: () => onQuit(),
    });
    engine.onPauseChange = setPaused;
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceKey]);

  const togglePause = useCallback(() => {
    engineRef.current?.togglePause();
    setPaused(engineRef.current?.paused ?? false);
  }, []);

  const touch = useCallback((patch: Parameters<WackyEngine["setTouchInput"]>[0]) => {
    engineRef.current?.setTouchInput(patch);
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 overflow-hidden bg-black"
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: "none", overscrollBehavior: "none" }}
    >
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
      <HudLayer settings={{ units: settings.units }} onPause={togglePause} trackId={setup.track} />
      {isTouch && (
        <TouchControls onTouch={touch} scale={settings.touchScale} swap={settings.swapTouch} tilt={settings.tilt} />
      )}
      {isTouch && <PortraitHint />}
      {paused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card anim-pop w-full max-w-sm p-6 text-center">
            <h3 className="text-3xl font-black">PAUSED</h3>
            <p className="mt-1 text-xs font-bold text-[#6b5a8e]">The chaos waits for you.</p>
            <div className="mt-5 flex flex-col gap-3">
              <button className="btn btn-green flex items-center justify-center gap-2 px-5 py-3 font-black" onClick={togglePause}>
                <Play size={18} /> Resume
              </button>
              <button className="btn btn-yellow flex items-center justify-center gap-2 px-5 py-3 font-black"
                onClick={() => { clickSfx(); onRestart(); }}>
                <RotateCcw size={18} /> Restart race
              </button>
              <button className="btn btn-red flex items-center justify-center gap-2 px-5 py-3 font-black"
                onClick={() => { clickSfx(); onQuit(); }}>
                <Home size={18} /> Quit to menu
              </button>
            </div>
            <p className="mt-4 text-[11px] font-bold text-[#a08fd0]">Esc = pause · E = item · Space = drift · H = horn</p>
          </div>
        </div>
      )}
    </div>
  );
}

function clickSfx() { AudioMan.click(); }

// ============================================================================
// HUD
// ============================================================================
function HudLayer({ settings, onPause, trackId }: {
  settings: { units: "kmh" | "mph" };
  onPause: () => void;
  trackId: string;
}) {
  const hud = useHud();
  const kmh = hud.speed;
  const displaySpeed = settings.units === "kmh" ? kmh : kmh * 0.621;
  const powerDef = POWERUPS.find((p) => p.id === hud.item);
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* ---------- top-left: position + laps ---------- */}
      <div className="absolute left-3 top-3 flex flex-col gap-2">
        <div className="hud-panel anim-pop flex items-center gap-2 px-4 py-2">
          <span className="text-4xl font-black text-[#ffd23f]" style={{ textShadow: "0 3px 0 #16181d" }}>
            P{hud.position}
          </span>
          <span className="text-lg font-black text-[#cbbdf3]">/ {hud.fieldSize}</span>
        </div>
        <div className="hud-panel flex items-center gap-2 px-4 py-1.5 text-sm font-black">
          <Flag size={14} className="text-[#ff5ca8]" />
          {hud.lapsTotal === 0 ? "FREE ROAM" : `LAP ${Math.max(1, hud.lap)}/${hud.lapsTotal}`}
        </div>
        <div className="hud-panel px-4 py-1.5 text-xs font-black text-[#cbbdf3]">
          <div className="flex items-center gap-1"><Timer size={12} /> Race {fmtTime(hud.raceTimeMs)}</div>
          {hud.lapsTotal > 0 && <div>Lap {fmtTime(hud.lapTimeMs)}</div>}
          {hud.bestLapMs !== null && <div className="text-[#ffd23f]">Best {fmtTime(hud.bestLapMs)}</div>}
        </div>
      </div>

      {/* ---------- top-right: coins + pause ---------- */}
      <div className="absolute right-3 top-3 flex items-start gap-2">
        <div className="hud-panel flex items-center gap-1.5 px-3 py-2 text-sm font-black text-[#ffd23f]">
          <Coins size={15} /> {hud.coins}
        </div>
        <button className="pointer-events-auto btn btn-dark p-2.5" onClick={() => { clickSfx(); onPause(); }}>
          <Pause size={18} />
        </button>
      </div>

      {/* ---------- countdown ---------- */}
      {hud.countdown >= 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div key={hud.countdown} className="anim-count text-9xl font-black text-[#ffd23f]" style={{ textShadow: "0 8px 0 #16181d, -4px 0 0 #16181d, 4px 0 0 #16181d" }}>
            {hud.countdown === 0 ? "GO!" : hud.countdown}
          </div>
        </div>
      )}

      {/* ---------- chaos banner ---------- */}
      {hud.chaosEvent && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2">
          <div className="btn btn-purple anim-pop px-6 py-2 text-lg font-black">{hud.chaosEvent}</div>
        </div>
      )}

      {/* ---------- wrong way ---------- */}
      {hud.wrongWay && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <div className="btn btn-red anim-shake flex items-center gap-2 px-5 py-2 text-sm font-black">
            <OctagonAlert size={17} /> WRONG WAY!
          </div>
        </div>
      )}

      {/* ---------- status chips ---------- */}
      <div className="absolute left-3 top-44 flex flex-col gap-1.5">
        {hud.frozen && <Chip icon={<Snowflake size={13} />} label="FROZEN" cls="text-[#9bf0ff]" />}
        {hud.reversed && <Chip icon={<ArrowLeftRight size={13} />} label="REVERSED!" cls="text-[#c792ff]" />}
        {hud.shielded && <Chip icon={<ShieldCheck size={13} />} label="SHIELDED" cls="text-[#66e0ff]" />}
        {hud.giant && <Chip icon={<ChevronsUp size={13} />} label="GIANT" cls="text-[#b6f34d]" />}
        {hud.offTrack && <Chip icon={<Flag size={13} />} label="OFF-TRACK" cls="text-[#ff7f2a]" />}
      </div>

      {/* ---------- feed ---------- */}
      <div className="absolute left-3 top-[45%] flex max-w-[240px] flex-col gap-1">
        {hud.feed.map((f) => (
          <div key={f.id} className="feed-msg hud-panel px-3 py-1.5 text-[11px] font-black" style={{ color: f.color ?? "#fff" }}>
            {f.text}
          </div>
        ))}
      </div>

      {/* ---------- minimap ---------- */}
      <div className="absolute bottom-3 left-3 hidden sm:block">
        <Minimap trackId={trackId} />
      </div>

      {/* ---------- speedometer ---------- */}
      <div className="absolute bottom-3 left-3 sm:left-[190px]">
        <div className="hud-panel px-4 py-2">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black tabular-nums" style={{ color: hud.boosting ? "#ffd23f" : "#fff" }}>
              {Math.round(displaySpeed)}
            </span>
            <span className="text-[10px] font-black text-[#cbbdf3]">{settings.units === "kmh" ? "KM/H" : "MPH"}</span>
            {hud.boosting && <Zap size={14} className="text-[#ffd23f]" />}
          </div>
          {/* boost meter */}
          <div className="mt-1 h-2.5 w-32 overflow-hidden rounded-full border-2 border-[#16181d] bg-[#1b1533]">
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${hud.boostCharge * 100}%`,
                background: hud.boostCharge > 0.85 ? "linear-gradient(90deg,#ffd23f,#ff9de2)" : "linear-gradient(90deg,#2dd4c8,#3ddc84)",
              }}
            />
          </div>
          <div className="mt-0.5 text-[9px] font-black text-[#a08fd0]">DRIFT BOOST</div>
        </div>
      </div>

      {/* ---------- item slot ---------- */}
      <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2">
        <div className={`hud-panel relative flex h-[74px] w-[74px] items-center justify-center ${hud.itemRolling ? "anim-wiggle" : ""}`}
          style={powerDef && !hud.itemRolling ? { background: `linear-gradient(180deg, ${powerDef.color}, ${powerDef.color}cc)` } : undefined}>
          {hud.itemRolling ? (
            <span className="anim-slot text-4xl font-black text-[#ffd23f]">?</span>
          ) : hud.item ? (
            <PowerIcon id={hud.item} size={38} />
          ) : (
            <span className="text-3xl font-black text-[#5b4a80]">?</span>
          )}
        </div>
        {powerDef && !hud.itemRolling && (
          <div className="hud-panel px-2.5 py-1 text-center text-[10px] font-black">
            {powerDef.name}
            <span className="hidden sm:inline text-[#a08fd0]"> — press E</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ icon, label, cls }: { icon: React.ReactNode; label: string; cls: string }) {
  return <span className={`hud-panel flex items-center gap-1 px-2.5 py-1 text-[11px] font-black ${cls}`}>{icon}{label}</span>;
}

// ============================================================================
// MINIMAP
// ============================================================================
function Minimap({ trackId }: { trackId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 90) return;
      last = t;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      // draw track: need world points — rebuild a quick spline
      const curvePts = track.points.map(([x, z]) => [x, z]);
      const samples = catmull(curvePts, 120);
      const xs = samples.map((p) => p[0]);
      const zs = samples.map((p) => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const sx = (W - 34) / Math.max(1, maxX - minX);
      const sz = (H - 34) / Math.max(1, maxZ - minZ);
      const s = Math.min(sx, sz);
      const px = (x: number) => 17 + (x - minX) * s + (W - 34 - (maxX - minX) * s) / 2;
      const pz = (z: number) => 17 + (z - minZ) * s + (H - 34 - (maxZ - minZ) * s) / 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      samples.forEach(([x, z], i) => { if (i === 0) ctx.moveTo(px(x), pz(z)); else ctx.lineTo(px(x), pz(z)); });
      ctx.closePath();
      ctx.strokeStyle = "#16181d";
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = track.theme.curbA;
      ctx.lineWidth = 5.5;
      ctx.stroke();
      // racers
      const racers = useHud.getState().racers;
      const N = samples.length;
      for (const r of racers) {
        const idx = Math.floor(r.t * N) % N;
        const [x, z] = samples[idx];
        ctx.beginPath();
        ctx.arc(px(x), pz(z), r.isPlayer ? 5.5 : 3.6, 0, Math.PI * 2);
        ctx.fillStyle = r.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = r.isPlayer ? "#ffffff" : "#16181d";
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [track]);

  return (
    <div className="hud-panel p-1.5">
      <canvas ref={ref} width={150} height={150} />
    </div>
  );
}

// closed Catmull-Rom sampled on CPU for the minimap
function catmull(pts: number[][], n: number): [number, number][] {
  const out: [number, number][] = [];
  const len = pts.length;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * len;
    const i0 = Math.floor(t) % len;
    const i1 = (i0 + 1) % len, i2 = (i0 + 2) % len, im = (i0 - 1 + len) % len;
    const u = t - Math.floor(t);
    const u2 = u * u, u3 = u2 * u;
    const x = 0.5 * ((2 * pts[i0][0]) + (-pts[im][0] + pts[i1][0]) * u + (2 * pts[im][0] - 5 * pts[i0][0] + 4 * pts[i1][0] - pts[i2][0]) * u2 + (-pts[im][0] + 3 * pts[i0][0] - 3 * pts[i1][0] + pts[i2][0]) * u3);
    const z = 0.5 * ((2 * pts[i0][1]) + (-pts[im][1] + pts[i1][1]) * u + (2 * pts[im][1] - 5 * pts[i0][1] + 4 * pts[i1][1] - pts[i2][1]) * u2 + (-pts[im][1] + 3 * pts[i0][1] - 3 * pts[i1][1] + pts[i2][1]) * u3);
    out.push([x, z]);
  }
  return out;
}

// ============================================================================
// PORTRAIT HINT (mobile)
// ============================================================================
function PortraitHint() {
  const [portrait, setPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setPortrait(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  if (!portrait || dismissed) return null;
  return (
    <div className="absolute left-1/2 top-16 z-40 w-[86%] max-w-sm -translate-x-1/2">
      <div className="hud-panel anim-pop flex items-center gap-3 p-3">
        <RotateCcw size={26} className="shrink-0 -rotate-90 text-[#ffd23f]" />
        <p className="flex-1 text-xs font-black leading-snug">
          Tilt your phone sideways for the full widescreen race view!
        </p>
        <button className="btn btn-white pointer-events-auto px-3 py-1.5 text-xs font-black" onClick={() => setDismissed(true)}>
          OK
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// TOUCH CONTROLS (scalable, swappable, safe-area aware)
// ============================================================================
function TouchControls({
  onTouch,
  scale,
  swap,
  tilt,
}: {
  onTouch: (p: { steer?: number; throttle?: number; brake?: number; drift?: boolean; item?: boolean }) => void;
  scale: number;
  swap: boolean;
  tilt: boolean;
}) {
  const [held, setHeld] = useState<Record<string, boolean>>({});
  const item = useHud((s) => s.item);
  const hold = (id: string, down: boolean, patch: Parameters<typeof onTouch>[0]) => {
    setHeld((h) => ({ ...h, [id]: down }));
    onTouch(patch);
  };
  const steer = (held.left ? -1 : 0) + (held.right ? 1 : 0);
  useEffect(() => {
    onTouch({ steer });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held.left, held.right]);

  const steerCluster = (
    <div
      className="pointer-events-none flex gap-3"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: swap ? "bottom right" : "bottom left",
      }}
    >
      {tilt ? (
        <div className="hud-panel flex h-20 items-center gap-2 px-4">
          <RotateCcw size={22} className="-rotate-90 text-[#2dd4c8]" />
          <span className="text-xs font-black">TILT
            <br />STEER</span>
        </div>
      ) : (
        <>
          <button
            className={`touch-btn pointer-events-auto h-20 w-20 ${held.left ? "active" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); hold("left", true, { steer: -1 }); }}
            onPointerUp={() => hold("left", false, {})}
            onPointerLeave={() => { if (held.left) hold("left", false, {}); }}
            onPointerCancel={() => { if (held.left) hold("left", false, {}); }}
          >
            <ChevronLeft size={38} />
          </button>
          <button
            className={`touch-btn pointer-events-auto h-20 w-20 ${held.right ? "active" : ""}`}
            onPointerDown={(e) => { e.preventDefault(); hold("right", true, { steer: 1 }); }}
            onPointerUp={() => hold("right", false, {})}
            onPointerLeave={() => { if (held.right) hold("right", false, {}); }}
            onPointerCancel={() => { if (held.right) hold("right", false, {}); }}
          >
            <ChevronRight size={38} />
          </button>
        </>
      )}
    </div>
  );

  const pedalCluster = (
    <div
      className="pointer-events-none flex items-end gap-3"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: swap ? "bottom left" : "bottom right",
      }}
    >
      <button
        className={`touch-btn pointer-events-auto h-16 w-16 text-xs font-black ${held.drift ? "active" : ""}`}
        onPointerDown={(e) => { e.preventDefault(); hold("drift", true, { drift: true }); }}
        onPointerUp={() => hold("drift", false, { drift: false })}
        onPointerLeave={() => { if (held.drift) hold("drift", false, { drift: false }); }}
        onPointerCancel={() => { if (held.drift) hold("drift", false, { drift: false }); }}
      >
        DRIFT
      </button>
      <button
        className={`touch-btn pointer-events-auto h-16 w-16 text-xs font-black ${held.brake ? "active" : ""}`}
        onPointerDown={(e) => { e.preventDefault(); hold("brake", true, { brake: 1 }); }}
        onPointerUp={() => hold("brake", false, { brake: 0 })}
        onPointerLeave={() => { if (held.brake) hold("brake", false, { brake: 0 }); }}
        onPointerCancel={() => { if (held.brake) hold("brake", false, { brake: 0 }); }}
      >
        STOP
      </button>
      <button
        className={`touch-btn pointer-events-auto h-24 w-24 text-base font-black ${held.gas ? "active" : ""}`}
        onPointerDown={(e) => { e.preventDefault(); hold("gas", true, { throttle: 1 }); }}
        onPointerUp={() => hold("gas", false, { throttle: 0 })}
        onPointerLeave={() => { if (held.gas) hold("gas", false, { throttle: 0 }); }}
        onPointerCancel={() => { if (held.gas) hold("gas", false, { throttle: 0 }); }}
      >
        GAS
      </button>
    </div>
  );

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-40"
      style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}
    >
      <div className="absolute bottom-0 left-3" style={{ paddingBottom: 0 }}>
        {swap ? pedalCluster : steerCluster}
      </div>
      <div className="absolute bottom-0 right-3">
        {swap ? steerCluster : pedalCluster}
      </div>
      {/* item button hangs above the pedals side */}
      {item && (
        <div className="absolute" style={{ bottom: 110 * scale, right: swap ? undefined : 12, left: swap ? 12 : undefined }}>
          <button
            className="touch-btn anim-pop pointer-events-auto text-xs font-black active:scale-95"
            style={{ height: 64 * scale, width: 64 * scale }}
            onPointerDown={(e) => { e.preventDefault(); onTouch({ item: true }); }}
          >
            <PowerIcon id={item} size={26} />
          </button>
        </div>
      )}
    </div>
  );
}
