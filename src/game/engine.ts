// ============================================================================
// WackyEngine — the whole game: renderer, arcade kart physics, spline track
// containment, drift/mini-turbo, items & hazards, bots, race modes, chaos
// events, particles, chase cam, HUD sync and (optional) P2P net sync.
// ============================================================================

import * as THREE from "three";
import { buildTrack, buildKart, buildDriver, buildBanana, buildChicken, type BuiltTrack } from "./builders";
import {
  trackById, modeById, vehicleById, powerupById, rollItem, upgradeMultipliers,
  VEHICLES, type Vehicle,
} from "./data";
import { AudioMan } from "./audio";
import { useHud, pushFeed, type RaceSetup, type Garage, type KeyBindings, type RaceSummary, type RaceStanding } from "@/lib/store";
import type { P2PRoom } from "./net";

// ---------------------------------------------------------------------------
// options & racer
// ---------------------------------------------------------------------------

export interface EngineOpts {
  canvas: HTMLCanvasElement;
  setup: RaceSetup;
  garage: Garage;
  playerName: string;
  settings: { quality: "low" | "high"; shake: boolean };
  controls: { keys: KeyBindings; sensitivity: number };
  upgrades: Record<string, Record<string, number>>;
  onFinish: (s: RaceSummary) => void;
  onQuit: () => void;
}

interface Hazard { kind: "banana"; pos: THREE.Vector3; owner: string; mesh: THREE.Group; ttl: number; }
interface Projectile { pos: THREE.Vector3; target: Racer | null; speed: number; mesh: THREE.Group; life: number; owner: string; }

interface Racer {
  id: string;
  name: string;
  isPlayer: boolean;
  isBot: boolean;
  remote: boolean;
  vehicle: Vehicle;
  color: string;
  root: THREE.Group;      // positioned/rotated in world
  visual: THREE.Group;    // flip/lean
  wheels: THREE.Mesh[];
  pos: THREE.Vector3;
  heading: number;
  speed: number;
  y: number;
  vy: number;
  airborne: boolean;
  flip: number;           // backflip progress
  idx: number;
  lat: number;
  t: number;
  prog: number;           // lap * N + idx
  lap: number;
  lapStartMs: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
  finished: boolean;
  eliminated: boolean;
  elimOrder: number;
  finishMs: number | null;
  position: number;
  item: string | null;
  itemCooldown: number;
  boosting: boolean;
  boostMs: number;
  drifting: boolean;
  driftDir: number;
  driftCharge: number;
  driftSeconds: number;
  spinout: number;
  frozenUntil: number;
  reverseUntil: number;
  shieldUntil: number;
  giantUntil: number;
  magnetUntil: number;
  offTrack: boolean;
  scale: number;
  coinsCollected: number;
  powerupsUsed: number;
  ai: { nextItemMs: number; targetLat: number; brakeUntil: number } | null;
  netState: { pos: number[]; heading: number; speed: number; lap: number; finished: boolean } | null;
  // bot-driven input + misc runtime fields
  botSteer?: number;
  botThrottle?: number;
  botBrake?: number;
  botDrift?: boolean;
  bandMul?: number;
  popTimer?: number;
  lastIdx?: number;
}

const BOT_NAMES = ["Turbo Tom", "Slippery Sue", "Banana Bob", "Zoom Zoe", "Crash Carl", "Turbo Tina"];
const COLORS = ["#ff5ca8", "#2dd4c8", "#ffd23f", "#8b5cf6", "#3ddc84", "#ff7f2a", "#66e0ff", "#ff4d6d"];

const COUNTDOWN_MS = 3200;

export class WackyEngine {
  paused = false;
  onPauseChange: ((paused: boolean) => void) | null = null;

  private opts: EngineOpts;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private track: BuiltTrack;
  private racers: Racer[] = [];
  private player!: Racer;
  private hazards: Hazard[] = [];
  private projectiles: Projectile[] = [];
  private particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number }[] = [];
  private keysDown = new Set<string>();
  private touch = { steer: 0, throttle: 0, brake: 0, drift: false, item: false };
  private tilt = 0;
  private raf = 0;
  private last = 0;
  private raceTimeMs = 0;
  private countdownMs = COUNTDOWN_MS;
  private lastCount = 4;
  private finished = false;
  private finishTimer = -1;
  private hudTimer = 0;
  private netTimer = 0;
  private chaosTimer = 0;
  private chaosUntil = 0;
  private chaosLabel: string | null = null;
  private shakeAmt = 0;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private itemSpotCooldown: number[] = [];
  private coinTaken: boolean[] = [];
  private lapsTotal: number;
  private mode: string;
  private fieldSize: number;
  private elimEveryLap = false;
  private teamMode = false;
  private chaosDouble = false;
  private disposers: (() => void)[] = [];
  private destroyed = false;

  constructor(opts: EngineOpts) {
    this.opts = opts;
    this.mode = opts.setup.mode;
    const modeDef = modeById(this.mode);
    this.lapsTotal = opts.setup.laps || modeDef.laps;
    this.elimEveryLap = this.mode === "elimination";
    this.teamMode = this.mode === "team";
    this.chaosDouble = this.mode === "chaos";

    // ---------- renderer ----------
    this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true, powerPreference: "high-performance" });
    const q = opts.settings.quality;
    this.renderer.setPixelRatio(q === "high" ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    this.renderer.shadowMap.enabled = q === "high";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.resize();

    // ---------- scene ----------
    const def = trackById(opts.setup.track);
    this.scene.background = new THREE.Color(def.theme.sky);
    this.scene.fog = new THREE.Fog(def.theme.fog, 70, 340);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);

    const hemi = new THREE.HemisphereLight(0xffffff, def.theme.ground, 1.15);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff6e0, 2.2);
    sun.position.set(60, 90, 40);
    if (q === "high") {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const c = sun.shadow.camera;
      c.left = -90; c.right = 90; c.top = 90; c.bottom = -90; c.far = 400;
    }
    this.scene.add(sun);

    // ---------- track ----------
    this.track = buildTrack(def);
    this.scene.add(this.track.group);
    if (q === "high") {
      this.track.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; }
      });
      const ground = this.track.group.children[0] as THREE.Mesh;
      if (ground?.isMesh) ground.receiveShadow = true;
    }
    this.itemSpotCooldown = this.track.pickupSpots.map(() => 0);
    this.coinTaken = this.track.coinSpots.map(() => false);

    // ---------- racers ----------
    const solo = this.mode === "time" || this.mode === "practice";
    this.fieldSize = solo ? 1 : 6;
    const g = opts.garage;
    const playerVeh = vehicleById(g.vehicle);
    this.addRacer({
      id: "player", name: opts.playerName, isPlayer: true, vehicle: playerVeh, color: "#ffd23f",
    });
    if (!solo) {
      const others = [...VEHICLES].filter((v) => v.id !== playerVeh.id);
      for (let i = 0; i < this.fieldSize - 1; i++) {
        const v = others[i % others.length];
        this.addRacer({
          id: `bot-${i}`, name: `${BOT_NAMES[i % BOT_NAMES.length]} (CPU)`, isBot: true, vehicle: v,
          color: COLORS[(i + 1) % COLORS.length],
        });
      }
    }
    this.placeOnGrid();

    // ---------- particles pool ----------
    const pGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    for (let i = 0; i < 180; i++) {
      const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      m.visible = false;
      this.scene.add(m);
      this.particles.push({ mesh: m, vel: new THREE.Vector3(), life: 0, maxLife: 1 });
    }

    // ---------- input ----------
    const onKeyDown = (e: KeyboardEvent) => this.handleKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => this.handleKey(e, false);
    const onResize = () => this.resize();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", onResize);
    this.disposers.push(() => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
    });

    AudioMan.ensure();
    AudioMan.startMusic("race");

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // =========================================================================
  // racer setup
  // =========================================================================

  private addRacer(init: { id: string; name: string; isPlayer?: boolean; isBot?: boolean; vehicle: Vehicle; color: string }): Racer {
    const upg = this.opts.upgrades[init.vehicle.id] ?? {};
    void upg;
    const kart = buildKart(init.vehicle, init.vehicle.paint, this.opts.garage.wheels);
    const driver = buildDriver(
      { id: this.opts.garage.character, name: "", price: 0 },
      this.opts.garage.hat,
    );
    driver.group.position.set(0, 0.55, -0.15);
    kart.group.add(driver.group);
    const root = new THREE.Group();
    const visual = new THREE.Group();
    visual.add(kart.group);
    root.add(visual);
    // player paint override
    if (init.isPlayer) {
      kart.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.material && (m.material as THREE.MeshStandardMaterial).color) {
          // leave as-is; paint comes from vehicle
        }
      });
    }
    this.scene.add(root);
    const racer: Racer = {
      id: init.id,
      name: init.name,
      isPlayer: !!init.isPlayer,
      isBot: !!init.isBot,
      remote: false,
      vehicle: init.vehicle,
      color: init.color,
      root, visual,
      wheels: kart.wheels,
      pos: new THREE.Vector3(),
      heading: 0,
      speed: 0,
      y: 0, vy: 0, airborne: false, flip: 0,
      idx: 0, lat: 0, t: 0, prog: 0,
      lap: 1, lapStartMs: 0, lastLapMs: null, bestLapMs: null,
      finished: false, eliminated: false, elimOrder: 0, finishMs: null, position: 1,
      item: null, itemCooldown: 0,
      boosting: false, boostMs: 0,
      drifting: false, driftDir: 0, driftCharge: 0, driftSeconds: 0,
      spinout: 0,
      frozenUntil: 0, reverseUntil: 0, shieldUntil: 0, giantUntil: 0, magnetUntil: 0,
      offTrack: false, scale: 1,
      coinsCollected: 0, powerupsUsed: 0,
      ai: init.isBot ? { nextItemMs: 3000 + Math.random() * 5000, targetLat: 0, brakeUntil: 0 } : null,
      netState: null,
    };
    this.racers.push(racer);
    if (init.isPlayer) this.player = racer;
    return racer;
  }

  private placeOnGrid(): void {
    const N = this.track.samples.length;
    this.racers.forEach((r, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2 === 0 ? -1 : 1;
      const idx = ((N - 10 - row * 8) % N + N) % N;
      const s = this.track.samples[idx];
      r.idx = idx;
      r.lat = col * 3.2;
      r.pos.copy(s.pos).addScaledVector(s.lat, r.lat);
      r.heading = Math.atan2(s.tan.x, s.tan.z);
      r.y = s.pos.y;
      r.prog = idx;
      r.root.position.copy(r.pos);
      r.root.rotation.y = r.heading;
    });
  }

  // =========================================================================
  // input
  // =========================================================================

  setTilt(v: number): void { this.tilt = v; }

  setTouchInput(patch: { steer?: number; throttle?: number; brake?: number; drift?: boolean; item?: boolean }): void {
    if (patch.item) {
      this.useItem(this.player);
      patch = { ...patch, item: false };
    }
    this.touch = { ...this.touch, ...patch };
  }

  private handleKey(e: KeyboardEvent, down: boolean): void {
    const k = this.opts.controls.keys;
    const code = e.code;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) e.preventDefault();
    if (down) {
      if (!this.keysDown.has(code)) {
        if (code === k.item) this.useItem(this.player);
        if (code === k.horn) { AudioMan.honk(this.opts.garage.horn); pushFeed("HONK! 🎺".replace(" 🎺", ""), "#ffd23f"); }
        if (code === k.pause) this.togglePause();
      }
      this.keysDown.add(code);
    } else {
      this.keysDown.delete(code);
    }
  }

  togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) AudioMan.setEngine(null);
    this.onPauseChange?.(this.paused);
  }

  private inputOf(r: Racer): { steer: number; throttle: number; brake: number; drift: boolean } {
    if (!r.isPlayer) {
      // bots steer via ai below
      return { steer: 0, throttle: 0, brake: 0, drift: false };
    }
    const k = this.opts.controls.keys;
    const sens = this.opts.controls.sensitivity;
    const key = (c: string) => this.keysDown.has(c);
    let steer = (key(k.left) || key("ArrowLeft") ? -1 : 0) + (key(k.right) || key("ArrowRight") ? 1 : 0);
    steer += this.touch.steer + this.tilt;
    steer = Math.max(-1, Math.min(1, steer)) * sens;
    const throttle = Math.max(key(k.up) || key("ArrowUp") ? 1 : 0, this.touch.throttle);
    const brake = Math.max(key(k.down) || key("ArrowDown") ? 1 : 0, this.touch.brake);
    const drift = key(k.drift) || this.touch.drift;
    return { steer, throttle, brake, drift };
  }

  // =========================================================================
  // main loop
  // =========================================================================

  private loop = (now: number): void => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.033, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused) {
      this.simulate(dt, now);
    }
    this.render(now);
  };

  private simulate(dt: number, now: number): void {
    // countdown
    if (this.countdownMs > 0) {
      const prev = this.countdownMs;
      this.countdownMs -= dt * 1000;
      const c = Math.ceil(this.countdownMs / 1000);
      if (c !== this.lastCount && c >= 0 && c <= 3) {
        this.lastCount = c;
        if (c > 0) AudioMan.sfx("count"); else AudioMan.sfx("go");
      }
      void prev;
    }
    const racing = this.countdownMs <= 0;
    if (racing) this.raceTimeMs += dt * 1000;

    // chaos events
    if (this.chaosDouble && racing) {
      this.chaosTimer += dt * 1000;
      if (this.chaosTimer > 15000 && now > this.chaosUntil) {
        this.chaosTimer = 0;
        this.chaosUntil = now + 8000;
        const events = ["BOUNCE FEST!", "TINY MODE!", "MOON GRAVITY!", "ITEM FRENZY!", "SPEED DEMON!"];
        this.chaosLabel = events[Math.floor(Math.random() * events.length)];
        pushFeed(`🌪️ ${this.chaosLabel}`, "#c792ff");
        AudioMan.sfx("rumble");
      }
      if (now > this.chaosUntil) { this.chaosUntil = 0; this.chaosLabel = null; }
    }

    // update racers
    for (const r of this.racers) {
      if (r.remote) { this.updateRemote(r, dt); continue; }
      if (r.isBot) this.botInput(r, dt, now);
      this.stepRacer(r, dt, now, racing);
    }

    this.collide();
    this.stepHazards(dt);
    this.stepProjectiles(dt, now);
    this.stepPickups(now);
    this.stepCoins(dt, now);
    this.updatePositions();
    this.stepLaps(now);
    this.stepNet(now);
    this.updateParticles(dt);

    // player HUD-ish state
    const p = this.player;
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
    AudioMan.setEngine(racing && !p.finished ? Math.abs(p.speed) / 60 : null);

    // throttled HUD push
    this.hudTimer += dt * 1000;
    if (this.hudTimer > 90) {
      this.hudTimer = 0;
      this.pushHud(now);
    }

    // finish detection
    if (!this.finished) {
      if (p.finished || (this.mode === "practice" && p.lap >= 2 && this.raceTimeMs > 15000)) {
        if (this.finishTimer < 0) this.finishTimer = 2200;
      } else if (this.elimEveryLap && p.eliminated) {
        if (this.finishTimer < 0) this.finishTimer = 1800;
      } else if (this.racers.every((r) => r.finished || r.eliminated)) {
        if (this.finishTimer < 0) this.finishTimer = 1200;
      }
      if (this.finishTimer >= 0) {
        this.finishTimer -= dt * 1000;
        if (this.finishTimer < 0) this.doFinish();
      }
    }
  }

  // =========================================================================
  // physics
  // =========================================================================

  private statsOf(r: Racer): { maxSpeed: number; accel: number; turn: number; driftRate: number; mass: number } {
    const s = r.vehicle.stats;
    const upg = upgradeMultipliers(this.opts.upgrades[r.vehicle.id] ?? {});
    let maxSpeed = (26 + (s.speed / 100) * 30) * upg.maxSpeed;
    let accel = (8 + (s.accel / 100) * 26) * upg.accel;
    let turn = (1.5 + (s.handling / 100) * 2.2) * upg.handling;
    let driftRate = (0.55 + (s.drift / 100) * 0.02 * 40) * upg.driftCharge;
    const mass = (0.6 + (s.weight / 100) * 0.9) * upg.mass;
    if (r.vehicle.ability === "Afterburner") maxSpeed *= 1.1;
    return { maxSpeed, accel, turn, driftRate, mass };
  }

  private stepRacer(r: Racer, dt: number, now: number, racing: boolean): void {
    const st = this.statsOf(r);
    const def = this.track.def;
    const N = this.track.samples.length;

    // timers
    r.boostMs = Math.max(0, r.boostMs - dt * 1000);
    r.itemCooldown = Math.max(0, r.itemCooldown - dt * 1000);
    r.boosting = r.boostMs > 0;

    const frozen = now < r.frozenUntil;
    const reversed = now < r.reverseUntil;
    const shielded = now < r.shieldUntil;
    const giant = now < r.giantUntil;
    r.scale = giant ? 1.75 : (this.chaosLabel === "TINY MODE!" && now < this.chaosUntil ? 0.55 : 1);

    const inp = this.inputOf(r);
    let steer = frozen ? 0 : inp.steer * (reversed ? -1 : 1);
    let throttle = frozen ? 0 : inp.throttle;
    let brake = frozen ? 0 : inp.brake;
    const wantDrift = inp.drift && !frozen;

    if (r.spinout > 0) {
      r.spinout -= dt;
      throttle = 0; brake = 0; steer = 0;
      r.speed = Math.max(0, r.speed - dt * 30);
    }

    if (!racing) { throttle = 0; brake = 0; steer = 0; }

    // chaos modifiers
    if (this.chaosLabel === "SPEED DEMON!" && now < this.chaosUntil) { throttle = Math.max(throttle, 1); }
    let accelMul = 1;
    if (this.chaosLabel === "SPEED DEMON!" && now < this.chaosUntil) accelMul = 2;

    // boost
    const boostMul = r.boosting ? (r.vehicle.ability === "Torpedo Mode" ? 1.5 : 1.38) : 1;
    const hotSlice = r.vehicle.ability === "Hot Slice" ? 1.25 : 1;
    if (r.boosting && r.vehicle.ability === "Hot Slice") r.boostMs = Math.max(r.boostMs, 0); // duration handled at grant
    void hotSlice;

    // longitudinal
    const maxSpeed = st.maxSpeed * boostMul * (giant ? 1.15 : 1);
    if (throttle > 0) r.speed += st.accel * accelMul * throttle * dt;
    if (brake > 0) {
      if (r.speed > 1) r.speed -= 26 * brake * dt;
      else r.speed = Math.max(-9, r.speed - 10 * brake * dt); // reverse
    }
    // drag + rolling resistance
    r.speed -= r.speed * 0.35 * dt;
    r.speed = Math.min(r.speed, maxSpeed);
    if (r.speed < -9) r.speed = -9;
    if (throttle === 0 && brake === 0) r.speed -= Math.sign(r.speed) * Math.min(Math.abs(r.speed), 6 * dt);

    // start boost ability
    if (r.vehicle.ability === "Grocery Rush" && this.raceTimeMs < 100 && !r.finished && r.boostMs <= 0) r.boostMs = 1200;
    // pop-up launch
    if (r.vehicle.ability === "Pop-Up Launch" && Math.abs(r.speed) < 1.5 && !frozen && racing) {
      r.popTimer = (r.popTimer ?? 0) + dt;
      if (r.popTimer > 20) { r.popTimer = 0; r.boostMs = Math.max(r.boostMs, 1300); AudioMan.sfx("boost"); this.burst(r.pos, 0xffd23f, 14, 3); }
    } else if (r.vehicle.ability === "Pop-Up Launch") r.popTimer = 0;

    // steering
    const speedFactor = Math.max(-1, Math.min(1, r.speed / 12));
    const drifting = wantDrift && Math.abs(steer) > 0.15 && r.speed > 9 && !r.airborne;
    if (drifting && !r.drifting) {
      r.drifting = true;
      r.driftDir = Math.sign(steer);
      r.driftCharge = 0;
    }
    if (r.drifting) {
      if (!wantDrift || r.speed <= 6 || r.airborne) {
        // release -> mini turbo
        const charge = r.driftCharge;
        r.drifting = false;
        if (charge > 1.35) {
          r.boostMs = Math.max(r.boostMs, 1700 * (r.vehicle.ability === "Hot Slice" ? 1.25 : 1));
          AudioMan.sfx("boost");
          this.burst(r.pos, 0xffd23f, 22, 4);
          pushFeed(r.isPlayer ? "GOLD TURBO!" : `${r.name} turbo!`, "#ffd23f");
        } else if (charge > 0.45) {
          r.boostMs = Math.max(r.boostMs, 850 * (r.vehicle.ability === "Hot Slice" ? 1.25 : 1));
          AudioMan.sfx("boost");
          this.burst(r.pos, 0x2dd4c8, 12, 3);
        }
        r.driftCharge = 0;
      } else {
        let rate = st.driftRate;
        if (r.vehicle.ability === "Bubble Slide" && def.grip < 1) rate *= 1.3;
        r.driftCharge += rate * dt;
        r.driftSeconds += dt;
        if (Math.random() < dt * 18) this.spark(r.pos, 0x9bf0ff, r.pos.clone().add(new THREE.Vector3(0, 0.3, 0)));
        if (r.isPlayer && Math.random() < dt * 6) AudioMan.sfx("drift");
      }
    }
    const turnMul = drifting ? 1.45 : 1;
    r.heading += steer * st.turn * turnMul * speedFactor * dt * (drifting ? r.driftDir || 1 : 1);

    // move
    const fx = Math.sin(r.heading), fz = Math.cos(r.heading);
    let mx = fx * r.speed, mz = fz * r.speed;
    if (r.drifting) {
      // slide sideways
      const lx = Math.cos(r.heading) * r.driftDir, lz = -Math.sin(r.heading) * r.driftDir;
      mx += lx * r.speed * 0.38;
      mz += lz * r.speed * 0.38;
      r.speed *= 1 - 0.25 * dt;
    }
    r.pos.x += mx * dt;
    r.pos.z += mz * dt;

    // track containment: nearest sample in a window around idx
    const s = this.nearestSample(r);
    r.t = r.idx / N;
    const dx = r.pos.x - s.pos.x, dz = r.pos.z - s.pos.z;
    r.lat = dx * s.lat.x + dz * s.lat.z;
    const halfW = this.track.width;
    r.offTrack = Math.abs(r.lat) > halfW;
    const wall = halfW + 9;
    if (Math.abs(r.lat) > wall) {
      // hard wall
      const over = Math.abs(r.lat) - wall;
      r.pos.x -= s.lat.x * Math.sign(r.lat) * over;
      r.pos.z -= s.lat.z * Math.sign(r.lat) * over;
      r.lat = Math.sign(r.lat) * wall;
      if (Math.abs(r.speed) > 12 && !shielded) {
        this.shakeAmt = Math.max(this.shakeAmt, r.isPlayer ? 0.5 : 0);
        if (r.isPlayer) AudioMan.sfx("hit");
        this.burst(r.pos, 0xffffff, 8, 3);
      }
      r.speed *= 0.6;
    } else if (r.offTrack) {
      // off-track slowdown (grass clippings ability barely notices)
      const slow = r.vehicle.ability === "Grass Clippings" ? 0.12 : 0.5;
      r.speed *= 1 - slow * dt * 3;
    }

    // ground / jumps
    const groundY = this.groundAt(r);
    const prevY = r.y;
    if (r.airborne) {
      const grav = r.vehicle.ability === "Sky High" ? 13 : (this.chaosLabel === "MOON GRAVITY!" && now < this.chaosUntil ? 7.5 : 22);
      r.vy -= grav * dt;
      r.y += r.vy * dt;
      if (r.y <= groundY) {
        r.y = groundY;
        r.airborne = false;
        const impact = -r.vy;
        r.vy = 0;
        r.flip = 0;
        if (impact > 9) {
          if (r.isPlayer) { AudioMan.sfx("land"); this.shakeAmt = Math.max(this.shakeAmt, 0.35); }
          this.burst(r.pos, 0xfff8ef, 10, 2.5);
          if (r.vehicle.ability === "Prehistoric Stomp" && impact > 10) {
            // shockwave
            for (const o of this.racers) {
              if (o === r || o.finished) continue;
              if (o.pos.distanceTo(r.pos) < 7.5 && now >= o.shieldUntil) {
                o.spinout = Math.max(o.spinout, 0.9);
                const d = o.pos.clone().sub(r.pos).setY(0).normalize();
                o.pos.addScaledVector(d, 3);
                o.speed *= 0.3;
              }
            }
            pushFeed("🦖 PREHISTORIC STOMP!", "#3ddc84");
            AudioMan.sfx("explosion");
          }
          if (r.vehicle.ability === "Kickflip") {
            r.boostMs = Math.max(r.boostMs, 950);
            if (r.isPlayer) pushFeed("KICKFLIP!", "#8b5cf6");
          }
        }
      } else {
        // airborne control + flip
        r.flip += dt * (2.2 + Math.abs(r.speed) * 0.06);
      }
    } else {
      // launch off ramps: positive slope while fast
      const s2 = this.track.samples[(r.idx + 3) % N];
      const slope = (s2.pos.y - s.pos.y) / 3;
      if (slope > 0.28 && r.speed > 14) {
        let vy = r.speed * slope * 1.15;
        if (r.vehicle.ability === "Updraft") vy *= 1.25;
        r.vy = vy;
        r.airborne = true;
        if (r.isPlayer) AudioMan.sfx("boost");
      } else {
        r.y = groundY;
      }
    }
    void prevY;

    // prog
    const prevIdx = r.prog % N;
    r.prog = (r.lap - 1) * N + r.idx;
    void prevIdx;

    // visuals
    r.root.position.set(r.pos.x, r.y + 0.02, r.pos.z);
    r.root.rotation.y = r.heading;
    r.root.scale.setScalar(r.scale);
    r.visual.rotation.x = r.airborne ? -Math.min(r.flip, Math.PI * 2) : 0;
    r.visual.rotation.z = -steer * 0.12 * Math.min(1, Math.abs(r.speed) / 20) + (r.drifting ? -r.driftDir * 0.18 : 0);
    for (let i = 0; i < r.wheels.length; i++) {
      const w = r.wheels[i];
      w.rotation.x += r.speed * dt * 2.4;
      if (i < 2) w.rotation.y = steer * 0.45;
    }

    // boost particles
    if (r.boosting && Math.random() < dt * 30) {
      const back = new THREE.Vector3(-fx, 0, -fz).multiplyScalar(1.4);
      this.spark(r.pos.clone().add(back).add(new THREE.Vector3(0, 0.5, 0)), r.driftCharge > 1.35 ? 0xffd23f : 0xff7f2a);
    }
  }

  private groundAt(r: Racer): number {
    return this.groundAtIdx(r.idx);
  }

  private groundAtIdx(idx: number): number {
    const N = this.track.samples.length;
    return this.track.samples[((idx % N) + N) % N].pos.y;
  }

  private nearestSample(r: Racer): { pos: THREE.Vector3; tan: THREE.Vector3; lat: THREE.Vector3 } {
    const N = this.track.samples.length;
    let best = r.idx;
    let bestD = Infinity;
    for (let k = -12; k <= 42; k++) {
      const i = ((r.idx + k) % N + N) % N;
      const s = this.track.samples[i];
      const dx = r.pos.x - s.pos.x, dz = r.pos.z - s.pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    r.idx = best;
    return this.track.samples[best];
  }

  // =========================================================================
  // bots
  // =========================================================================

  private botInput(r: Racer, dt: number, now: number): void {
    const N = this.track.samples.length;
    const ahead = 8 + r.speed * 0.45;
    const sA = this.track.samples[(r.idx + Math.floor(ahead)) % N];
    // target lateral: racing line
    const line = Math.sin((r.idx / N) * Math.PI * 4) * this.track.width * 0.45;
    r.ai!.targetLat = line;
    // steer toward target point
    const tx = sA.pos.x + sA.lat.x * line;
    const tz = sA.pos.z + sA.lat.z * line;
    const dx = tx - r.pos.x, dz = tz - r.pos.z;
    const targetHeading = Math.atan2(dx, dz);
    let diff = targetHeading - r.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // avoid hazards
    for (const h of this.hazards) {
      const hd = h.pos.distanceTo(r.pos);
      if (hd < 9) {
        const away = r.pos.clone().sub(h.pos).setY(0).normalize();
        const ah = Math.atan2(away.x, away.z);
        let ad = ah - r.heading;
        while (ad > Math.PI) ad -= Math.PI * 2;
        while (ad < -Math.PI) ad += Math.PI * 2;
        if (Math.abs(ad) < 1.2) diff += Math.sign(ad || 1) * 0.9;
      }
    }
    // curvature ahead -> brake + drift
    const sB = this.track.samples[(r.idx + Math.floor(ahead + 14)) % N];
    const a1 = Math.atan2(sA.tan.x, sA.tan.z);
    const a2 = Math.atan2(sB.tan.x, sB.tan.z);
    let curve = a2 - a1;
    while (curve > Math.PI) curve -= Math.PI * 2;
    while (curve < -Math.PI) curve += Math.PI * 2;
    const braking = Math.abs(curve) > 0.55 && r.speed > 26;
    if (braking) r.ai!.brakeUntil = now + 600;

    // rubber-band vs player
    const p = this.player;
    const gap = p.prog - r.prog;
    let maxMul = 1;
    if (gap > 120) maxMul = 1.12;
    else if (gap < -150) maxMul = 0.92;
    r.bandMul = maxMul;

    // write into a fake input by monkey-patching inputOf via ai fields
    r.botSteer = Math.max(-1, Math.min(1, diff * 2.4));
    r.botThrottle = now < r.ai!.brakeUntil ? 0 : 1;
    r.botBrake = now < r.ai!.brakeUntil ? 1 : 0;
    r.botDrift = Math.abs(curve) > 0.5 && r.speed > 24;

    // item use
    r.ai!.nextItemMs -= dt * 1000;
    if (r.item && r.ai!.nextItemMs <= 0 && now > r.frozenUntil) {
      this.useItem(r);
      r.ai!.nextItemMs = 4000 + Math.random() * 6000;
    }
  }

  // =========================================================================
  // items
  // =========================================================================

  private useItem(r: Racer): void {
    if (!r.item || r.itemCooldown > 0 || r.finished) return;
    if (this.countdownMs > 0) return;
    const id = r.item;
    r.item = null;
    r.itemCooldown = this.chaosDouble ? 400 : 1500;
    r.powerupsUsed += 1;
    const now = performance.now();
    const def = powerupById(id);
    pushFeed(`${r.name}: ${def.name}!`, def.color);
    switch (id) {
      case "rocket":
        r.boostMs = Math.max(r.boostMs, r.vehicle.ability === "Torpedo Mode" ? 3400 : 2600);
        AudioMan.sfx("boost");
        break;
      case "banana": {
        const back = new THREE.Vector3(-Math.sin(r.heading), 0, -Math.cos(r.heading)).multiplyScalar(2.6);
        const pos = r.pos.clone().add(back);
        const mesh = buildBanana();
        mesh.position.copy(pos).add(new THREE.Vector3(0, 0.4, 0));
        this.scene.add(mesh);
        this.hazards.push({ kind: "banana", pos, owner: r.id, mesh, ttl: 30 });
        AudioMan.sfx("splash");
        break;
      }
      case "punch": {
        r.boostMs = Math.max(r.boostMs, 1300);
        AudioMan.sfx("explosion");
        const fwd = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
        for (const o of this.racers) {
          if (o === r || o.finished) continue;
          const to = o.pos.clone().sub(r.pos);
          if (to.length() < 9 && to.normalize().dot(fwd) > 0.2 && now >= o.shieldUntil) {
            o.spinout = Math.max(o.spinout, 1.0);
            o.pos.addScaledVector(fwd, 4 * (r.vehicle.ability === "Crusher" ? 2 : 1));
            o.speed *= 0.25;
          }
        }
        this.burst(r.pos, 0xff7f2a, 18, 4);
        break;
      }
      case "magnet":
        r.magnetUntil = now + 6000;
        AudioMan.sfx("shield");
        break;
      case "shield":
        r.shieldUntil = now + (r.vehicle.ability === "Bath Time" ? 16000 : 8000);
        AudioMan.sfx("shield");
        break;
      case "freeze": {
        AudioMan.sfx("freeze");
        for (const o of this.racers) {
          if (o === r || o.isPlayer === false && false) continue;
          if (o === r || o.finished) continue;
          if (o.prog > r.prog && o.pos.distanceTo(r.pos) < 50 && now >= o.shieldUntil) {
            o.frozenUntil = now + 3000;
          }
        }
        break;
      }
      case "giant":
        r.giantUntil = now + 6000;
        AudioMan.sfx("grow");
        break;
      case "chicken": {
        // target: rival just ahead
        const rivals = this.racers
          .filter((o) => o !== r && !o.finished && o.prog > r.prog)
          .sort((a, b) => a.prog - b.prog);
        const target = rivals[0] ?? null;
        const mesh = buildChicken();
        mesh.position.copy(r.pos).add(new THREE.Vector3(0, 1, 0));
        this.scene.add(mesh);
        this.projectiles.push({ pos: r.pos.clone().add(new THREE.Vector3(0, 1, 0)), target, speed: 34, mesh, life: 6, owner: r.id });
        AudioMan.sfx("chicken");
        break;
      }
      case "reverse":
        AudioMan.sfx("teleport");
        for (const o of this.racers) {
          if (o === r || o.finished) continue;
          if (now >= o.shieldUntil) o.reverseUntil = now + 5000;
        }
        break;
      case "teleport": {
        AudioMan.sfx("teleport");
        const others = this.racers.filter((o) => o !== r && !o.finished);
        if (others.length) {
          const o = others[Math.floor(Math.random() * others.length)];
          const tmpPos = r.pos.clone(), tmpIdx = r.idx, tmpLat = r.lat, tmpProg = r.prog, tmpLap = r.lap;
          r.pos.copy(o.pos); r.idx = o.idx; r.lat = o.lat; r.prog = o.prog; r.lap = o.lap;
          o.pos.copy(tmpPos); o.idx = tmpIdx; o.lat = tmpLat; o.prog = tmpProg; o.lap = tmpLap;
          this.burst(r.pos, 0x8b5cf6, 16, 4);
          this.burst(o.pos, 0x8b5cf6, 16, 4);
        }
        break;
      }
    }
    if (r.isPlayer) AudioMan.sfx("pickup");
    if (this.chaosDouble && Math.random() < 0.5) {
      r.item = rollItem(r.position, this.fieldSize);
    }
  }

  private stepHazards(dt: number): void {
    for (const h of this.hazards) {
      h.ttl -= dt;
      h.mesh.rotation.y += dt * 3;
      h.mesh.position.y = h.pos.y + 0.4 + Math.sin(performance.now() / 300) * 0.1;
    }
    // collisions
    for (const r of this.racers) {
      if (r.finished || r.remote) continue;
      const now = performance.now();
      for (const h of this.hazards) {
        if (h.owner === r.id) continue;
        if (now < r.shieldUntil || now < r.giantUntil) {
          if (r.pos.distanceTo(h.pos) < 2.2 * r.scale) { h.ttl = 0; this.burst(h.pos, 0x66e0ff, 8, 2); }
          continue;
        }
        if (r.pos.distanceTo(h.pos) < 2.0 * r.scale) {
          h.ttl = 0;
          const slip = r.vehicle.ability === "Rolling Fortress" ? 0 : (this.opts && h.kind === "banana" ? 1.4 : 1.2);
          if (slip > 0) {
            r.spinout = Math.max(r.spinout, slip);
            r.speed = 0;
            AudioMan.sfx("spinout");
            this.burst(r.pos, 0xffd23f, 12, 3);
            // brain freeze: chill the dropper
            const owner = this.racers.find((o) => o.id === h.owner);
            if (owner && r.vehicle.ability === "Brain Freeze" && now >= owner.shieldUntil) {
              owner.frozenUntil = now + 2000;
              pushFeed(`${owner.name} got brain-frozen!`, "#9bf0ff");
            }
          }
        }
      }
    }
    this.hazards = this.hazards.filter((h) => {
      if (h.ttl <= 0) { this.scene.remove(h.mesh); return false; }
      return true;
    });
  }

  private stepProjectiles(dt: number, now: number): void {
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.target && !p.target.finished) {
        const to = p.target.pos.clone().sub(p.pos).setY(0).normalize();
        p.pos.addScaledVector(to, p.speed * dt);
        p.mesh.lookAt(p.target.pos.x, p.pos.y, p.target.pos.z);
        if (p.pos.distanceTo(p.target.pos) < 2.2 * p.target.scale) {
          p.life = 0;
          if (now >= p.target.shieldUntil) {
            p.target.spinout = Math.max(p.target.spinout, 1.5);
            p.target.speed = 0;
            AudioMan.sfx("chicken");
            this.burst(p.target.pos, 0xfff8ef, 16, 3);
            if (p.target.isPlayer) pushFeed("🐔 TURBO CHICKEN HIT!", "#fff8ef");
          }
        }
      } else {
        p.pos.y += 0; // flies straight
      }
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.z += dt * 12;
    }
    this.projectiles = this.projectiles.filter((p) => {
      if (p.life <= 0) { this.scene.remove(p.mesh); return false; }
      return true;
    });
  }

  private stepPickups(now: number): void {
    for (let i = 0; i < this.track.pickupSpots.length; i++) {
      const spot = this.track.pickupSpots[i];
      const box = this.track.itemBoxes[i];
      if (this.itemSpotCooldown[i] > 0) {
        this.itemSpotCooldown[i] -= 1; // decremented per frame (~cooldown frames)
        box.visible = false;
        continue;
      }
      box.visible = true;
      box.rotation.y += 0.03;
      box.position.y = spot.y + Math.sin(now / 400 + i) * 0.15;
      for (const r of this.racers) {
        if (r.finished || r.item || r.remote) continue;
        const magnet = now < r.magnetUntil || r.vehicle.ability === "Tractor Beam";
        const distSq = r.pos.distanceToSquared(spot);
        if (distSq < (magnet ? 10 * 10 : 2.6 * 2.6) * r.scale * r.scale) {
          r.item = rollItem(r.position, this.fieldSize);
          r.itemCooldown = 800;
          this.itemSpotCooldown[i] = 240; // ~4s at 60fps
          AudioMan.sfx("pickup");
          this.burst(spot, 0x2dd4c8, 10, 2.5);
          if (r.isPlayer) useHud.setState({ itemRolling: true });
          setTimeout(() => {
            useHud.setState({ itemRolling: false, item: useHud.getState().item });
          }, 700);
          break;
        }
      }
    }
  }

  private stepCoins(dt: number, now: number): void {
    const magnetR = this.racers.filter((r) => now < r.magnetUntil || r.vehicle.ability === "Tractor Beam");
    for (let i = 0; i < this.track.coinSpots.length; i++) {
      if (this.coinTaken[i]) {
        // respawn after 8s
        if ((now / 1000 + i) % 8 < dt) this.coinTaken[i] = false;
        continue;
      }
      const spot = this.track.coinSpots[i];
      const coin = this.track.coins[i];
      coin.rotation.y += dt * 4;
      coin.position.y = spot.y + Math.sin(now / 350 + i * 2) * 0.12;
      for (const r of this.racers) {
        if (r.finished || r.remote) continue;
        let dSq = r.pos.distanceToSquared(spot);
        const pull = magnetR.includes(r) ? 13 : 0;
        if (pull > 0 && dSq < pull * pull && dSq > 0.01) {
          // magnet: move coin toward racer
          const d = Math.sqrt(dSq);
          const dir = r.pos.clone().sub(spot).setY(0).normalize();
          spot.addScaledVector(dir, (pull - d) * 0.25);
          coin.position.copy(spot);
          dSq = r.pos.distanceToSquared(spot);
        }
        if (dSq < 2.4 * 2.4 * r.scale * r.scale) {
          this.coinTaken[i] = true;
          r.coinsCollected += 1;
          coin.visible = false;
          if (r.isPlayer) {
            AudioMan.sfx("coin");
            if (r.vehicle.ability === "Caffeine Rush") r.boostMs = Math.max(r.boostMs, 260);
          }
          break;
        }
      }
      if (this.coinTaken[i]) coin.visible = false;
      else coin.visible = true;
    }
  }

  private collide(): void {
    const now = performance.now();
    const rs = this.racers.filter((r) => !r.remote);
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i], b = rs[j];
        if (a.finished && b.finished) continue;
        const d = a.pos.distanceTo(b.pos);
        const minD = 1.9 * (a.scale + b.scale) / 2;
        if (d < minD && d > 0.001) {
          const ma = this.statsOf(a).mass, mb = this.statsOf(b).mass;
          const dir = b.pos.clone().sub(a.pos).setY(0).normalize();
          const overlap = minD - d;
          const total = ma + mb;
          a.pos.addScaledVector(dir, -overlap * (mb / total));
          b.pos.addScaledVector(dir, overlap * (ma / total));
          // speed exchange
          const rel = b.speed - a.speed;
          if (rel < -2) {
            a.speed += rel * 0.35 * (mb / total);
            b.speed -= rel * 0.35 * (ma / total);
            if (Math.abs(rel) > 8) {
              if (a.isPlayer || b.isPlayer) { AudioMan.sfx("hit"); this.shakeAmt = Math.max(this.shakeAmt, 0.3); }
              this.burst(a.pos.clone().lerp(b.pos, 0.5), 0xffffff, 6, 2);
              // brain freeze
              if (a.vehicle.ability === "Brain Freeze" && now >= b.shieldUntil) b.frozenUntil = now + 2000;
              if (b.vehicle.ability === "Brain Freeze" && now >= a.shieldUntil) a.frozenUntil = now + 2000;
              // egg kick: small boost for chicken bike bump
              if (a.vehicle.ability === "Egg Kick") a.boostMs = Math.max(a.boostMs, 500);
              if (b.vehicle.ability === "Egg Kick") b.boostMs = Math.max(b.boostMs, 500);
            }
          }
        }
      }
    }
  }

  // =========================================================================
  // laps / positions / modes
  // =========================================================================

  private updatePositions(): void {
    const sorted = [...this.racers].sort((a, b) => rankOf(b) - rankOf(a));
    sorted.forEach((r, i) => { r.position = i + 1; });
    function rankOf(r: Racer): number {
      if (r.finished && !r.eliminated) return 1e12 - (r.finishMs ?? 0); // finished first, by time
      if (r.eliminated) return 1e6 - r.elimOrder * 1000; // eliminated after finishers
      return r.prog;
    }
  }

  private stepLaps(now: number): void {
    const N = this.track.samples.length;
    let leaderLap = 1;
    for (const r of this.racers) {
      if (r.lap > leaderLap) leaderLap = r.lap;
      const idx = r.idx;
      const prevIdx = (r.prog - (r.lap - 1) * N); // previous idx stored in prog math below
      void prevIdx;
      // detect start-line crossing via idx wrap
      const prev = r.lastIdx ?? idx;
      if (prev > N - 60 && idx < 60 && !r.finished) {
        // crossed forward
        const lapMs = now - r.lapStartMs;
        if (r.lap >= 1 && this.raceTimeMs > 2000) {
          r.lastLapMs = lapMs;
          if (!r.bestLapMs || lapMs < r.bestLapMs) r.bestLapMs = lapMs;
          if (r.isPlayer) AudioMan.sfx("lap");
        }
        r.lap += 1;
        r.lapStartMs = now;
        r.prog = (r.lap - 1) * N + idx;
        if (this.lapsTotal > 0 && r.lap > this.lapsTotal && !r.finished) {
          r.finished = true;
          r.finishMs = this.raceTimeMs;
          if (r.isPlayer) {
            AudioMan.sfx("finish");
            AudioMan.startMusic("menu");
            pushFeed("🏁 FINISHED!", "#ffd23f");
          } else {
            pushFeed(`${r.name} finished P${r.position}`, "#cbbdf3");
          }
        }
      } else if (prev < 60 && idx > N - 60 && r.lap > 1) {
        r.lap -= 1; // went backwards over the line
        r.prog = (r.lap - 1) * N + idx;
      }
      r.lastIdx = idx;
    }
    // elimination: when leader gains a lap, yeet last place
    if (this.elimEveryLap && leaderLap >= 2) {
      const alive = this.racers.filter((r) => !r.finished && !r.eliminated);
      if (alive.length > 1) {
        alive.sort((a, b) => a.prog - b.prog);
        const last = alive[0];
        // only eliminate once per lap mark
        if (!last.eliminated && leaderLap > (this.lastElimLap ?? 1)) {
          this.lastElimLap = leaderLap;
          last.eliminated = true;
          last.elimOrder = (this.elimCount = (this.elimCount ?? 0) + 1);
          last.speed = 0;
          AudioMan.sfx("yeet");
          pushFeed(`💥 ${last.name} was YEETED! (P${this.racers.length - this.elimCount + 1})`, "#ff4d6d");
          this.burst(last.pos, 0xff4d6d, 24, 5);
          if (last.isPlayer) {
            last.finished = true;
            last.finishMs = this.raceTimeMs;
            setTimeout(() => { if (!this.finished) { this.finishTimer = 10; } }, 1200);
          }
        }
      }
    }
  }

  private lastElimLap = 1;
  private elimCount = 0;

  // =========================================================================
  // net (friends mode)
  // =========================================================================

  private stepNet(now: number): void {
    const net = this.opts.setup.net;
    if (!net) return;
    this.netTimer += 1;
    if (this.netTimer < 6) return; // ~10 Hz
    this.netTimer = 0;
    const room: P2PRoom = net.room;
    try {
      if (net.role === "host") {
        room.send({
          t: "state",
          racers: this.racers.map((r) => ({
            id: r.id, name: r.name, vehicleId: r.vehicle.id, color: r.color,
            pos: [r.pos.x, r.pos.y, r.pos.z], heading: r.heading, speed: r.speed,
            lap: r.lap, idx: r.idx, finished: r.finished, eliminated: r.eliminated,
            item: r.item, isPlayer: r.isPlayer,
          })),
          raceTimeMs: this.raceTimeMs,
          countdownMs: this.countdownMs,
          finished: this.finished,
        });
        if (this.finished) room.send({ t: "finish", standings: this.standings() });
      } else {
        const p = this.player;
        room.send({
          t: "me",
          id: room.peerId, name: this.opts.playerName, vehicleId: p.vehicle.id, color: p.color,
          pos: [p.pos.x, p.pos.y, p.pos.z], heading: p.heading, speed: p.speed,
          lap: p.lap, idx: p.idx, finished: p.finished,
        });
      }
    } catch { /* net errors are non-fatal */ }
    void now;
  }

  /** handle incoming net messages (called from menus wiring or here via room.onMessage) */
  wireNet(): void {
    const net = this.opts.setup.net;
    if (!net) return;
    const room = net.room;
    room.onMessage = (from, data) => {
      try {
        const msg = data as { t?: string };
        if (net.role === "peer" && msg.t === "state") {
          const st = msg as unknown as { racers: Array<Record<string, unknown>> };
          for (const rs of st.racers) {
            let r = this.racers.find((x) => x.id === (rs.id as string));
            if (!r) {
              r = this.addRacer({
                id: rs.id as string, name: String(rs.name), vehicle: vehicleById(String(rs.vehicleId)),
                color: String(rs.color ?? "#ffffff"),
              });
              r.remote = true;
              r.ai = null;
            }
            const pos = rs.pos as number[];
            r.pos.set(pos[0], pos[1], pos[2]);
            r.heading = rs.heading as number;
            r.speed = rs.speed as number;
            r.lap = rs.lap as number;
            r.idx = rs.idx as number;
            r.finished = !!rs.finished;
            r.eliminated = !!rs.eliminated;
            r.item = (rs.item as string) ?? null;
            r.root.position.copy(r.pos);
            r.root.rotation.y = r.heading;
          }
        } else if (net.role === "host" && msg.t === "me") {
          const m = msg as unknown as { id: string; pos: number[]; heading: number; speed: number; lap: number; idx: number; finished: boolean };
          let r = this.racers.find((x) => x.id === m.id);
          if (!r) {
            r = this.addRacer({ id: m.id, name: `Friend (${m.id.slice(0, 4)})`, vehicle: vehicleById("shopping-cart"), color: "#66e0ff" });
            r.remote = true;
            r.ai = null;
          }
          r.pos.set(m.pos[0], m.pos[1], m.pos[2]);
          r.heading = m.heading;
          r.speed = m.speed;
          r.lap = m.lap;
          r.idx = m.idx;
          r.prog = m.lap * this.track.samples.length + m.idx;
          r.finished = m.finished;
        } else if (msg.t === "finish") {
          if (!this.finished) this.doFinish();
        }
      } catch { /* ignore */ }
      void from;
    };
  }

  private updateRemote(r: Racer, dt: number): void {
    // remote racers are driven by network state; just animate wheels
    for (const w of r.wheels) w.rotation.x += r.speed * dt * 2.4;
    r.root.position.set(r.pos.x, r.y + 0.02, r.pos.z);
    r.root.rotation.y = r.heading;
    r.t = r.idx / this.track.samples.length;
  }

  // =========================================================================
  // HUD
  // =========================================================================

  private pushHud(now: number): void {
    const p = this.player;
    const N = this.track.samples.length;
    const s = this.track.samples[p.idx];
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const wrongWay = (fx * s.tan.x + fz * s.tan.z) < -0.25 && Math.abs(p.speed) > 6;
    const countdown = this.countdownMs > 0 ? Math.max(0, Math.ceil(this.countdownMs / 1000)) : -1;
    useHud.setState({
      speed: Math.abs(p.speed) * 3.6,
      item: p.item,
      position: p.position,
      fieldSize: this.fieldSize,
      lap: Math.max(1, Math.min(p.lap, this.lapsTotal || p.lap)),
      lapsTotal: this.lapsTotal,
      raceTimeMs: this.raceTimeMs,
      lapTimeMs: now - p.lapStartMs,
      bestLapMs: p.bestLapMs,
      countdown,
      chaosEvent: this.chaosLabel,
      wrongWay,
      frozen: now < p.frozenUntil,
      reversed: now < p.reverseUntil,
      shielded: now < p.shieldUntil,
      giant: now < p.giantUntil,
      offTrack: p.offTrack,
      coins: p.coinsCollected,
      boosting: p.boosting,
      boostCharge: p.drifting ? Math.min(1, p.driftCharge / 1.6) : (p.boosting ? 1 : 0),
      racers: this.racers.map((r) => ({ id: r.id, t: r.idx / N, isPlayer: r.isPlayer, color: r.color })),
    });
  }

  // =========================================================================
  // particles
  // =========================================================================

  private spark(pos: THREE.Vector3, color: number, at?: THREE.Vector3): void {
    const p = this.particles.find((x) => x.life <= 0);
    if (!p) return;
    p.life = p.maxLife = 0.5 + Math.random() * 0.4;
    p.mesh.visible = true;
    p.mesh.position.copy(at ?? pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.4, Math.random() * 0.8, (Math.random() - 0.5) * 1.4));
    (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    p.mesh.scale.setScalar(0.7 + Math.random() * 0.9);
    p.vel.set((Math.random() - 0.5) * 6, Math.random() * 5 + 1, (Math.random() - 0.5) * 6);
  }

  private burst(pos: THREE.Vector3, color: number, n: number, spread: number): void {
    for (let i = 0; i < n; i++) {
      const p = this.particles.find((x) => x.life <= 0);
      if (!p) return;
      p.life = p.maxLife = 0.4 + Math.random() * 0.5;
      p.mesh.visible = true;
      p.mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1, (Math.random() - 0.5) * 1.5));
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      p.mesh.scale.setScalar(0.6 + Math.random() * 1.1);
      p.vel.set((Math.random() - 0.5) * spread * 2, Math.random() * spread + 2, (Math.random() - 0.5) * spread * 2);
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vel.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.multiplyScalar(1 - dt * 1.6);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, p.life / p.maxLife);
    }
  }

  // =========================================================================
  // camera & render
  // =========================================================================

  private render(now: number): void {
    // resize handled by listener; ensure camera aspect
    const p = this.player;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const dist = 8.5 + Math.abs(p.speed) * 0.05;
    const height = 4.2;
    const target = new THREE.Vector3(
      p.pos.x - fx * dist,
      p.y + height,
      p.pos.z - fz * dist,
    );
    // keep camera above ground
    const camGround = this.groundAtIdx(p.idx) + 1.2;
    if (target.y < camGround) target.y = camGround;
    this.camPos.lerp(target, 0.12);
    this.camera.position.copy(this.camPos);
    if (this.opts.settings.shake && this.shakeAmt > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt * 0.4;
    }
    this.camLook.set(p.pos.x + fx * 7, p.y + 1.4, p.pos.z + fz * 7);
    this.camera.lookAt(this.camLook);
    // fov kick on boost
    const targetFov = 62 + (p.boosting ? 10 : 0) + Math.abs(p.speed) * 0.08;
    this.camera.fov += (targetFov - this.camera.fov) * 0.1;
    this.camera.updateProjectionMatrix();
    // animate obstacles
    for (const o of this.track.obstacles) {
      const t = now / 1000 * o.speed + o.phase;
      const off = Math.sin(t) * o.range;
      (o.mesh as THREE.Mesh).position.set(
        o.base.x + (o.axis === "x" ? off : 0),
        o.base.y + 1.6 + Math.abs(Math.sin(t)) * 0.3,
        o.base.z + (o.axis === "z" ? off : 0),
      );
      o.mesh.rotation.y += 0.01;
    }
    void now;
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const canvas = this.opts.canvas;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // =========================================================================
  // finish
  // =========================================================================

  private standings(): RaceStanding[] {
    const sorted = [...this.racers].sort((a, b) => a.position - b.position);
    return sorted.map((r) => ({
      name: r.name,
      position: r.position,
      isPlayer: r.isPlayer,
      vehicleId: r.vehicle.id,
      color: r.color,
      totalMs: r.finished ? r.finishMs : null,
    }));
  }

  private doFinish(): void {
    if (this.finished) return;
    this.finished = true;
    AudioMan.stopMusic();
    AudioMan.sfx("fanfare");
    const p = this.player;
    const summary: RaceSummary = {
      mode: this.mode,
      track: this.opts.setup.track,
      vehicleId: p.vehicle.id,
      position: p.position,
      fieldSize: this.fieldSize,
      totalMs: Math.round(this.raceTimeMs),
      bestLapMs: p.bestLapMs ? Math.round(p.bestLapMs) : null,
      coinsCollected: p.coinsCollected,
      powerupsUsed: p.powerupsUsed,
      drifts: Math.round(p.driftSeconds),
      standings: this.standings(),
    };
    this.opts.onFinish(summary);
  }

  // =========================================================================
  // teardown
  // =========================================================================

  dispose(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    for (const d of this.disposers) d();
    AudioMan.setEngine(null);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      }
    });
    this.renderer.dispose();
  }
}
