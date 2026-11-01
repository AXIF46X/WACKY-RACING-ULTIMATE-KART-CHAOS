// ============================================================================
// WACKY RACING: ULTIMATE KART CHAOS — core game engine (Three.js, client-side)
// Arcade kart physics · bots · 10 power-ups · hazards · 8 modes · P2P sync
// ============================================================================
import * as THREE from "three";
import {
  TRACKS, VEHICLES, CHARACTERS, MODES, HATS, BOT_NAMES, GP_POINTS,
  getUpgrades, upgradedStats, type PowerId, type TrackDef, type VehicleDef,
  type CharacterDef, type VehicleUpgrades, type UpgradeMap,
} from "./data";
import {
  buildTrack, buildKart, buildDriver, buildPickupBox, buildBananaMesh, buildCoinMesh,
  buildEggMesh, buildChickenMesh, buildShieldBubble, buildGloveMesh, buildIceBlock,
  type BuiltTrack, type BuiltKart,
} from "./builders";
import { AudioMan } from "./audio";
import { useHud, type GarageSel, type RaceSetup, type RaceSummary, type NetRoomInfo, type KeyBindings } from "@/lib/store";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

export interface InputState {
  steer: number;
  throttle: number;
  brake: number;
  drift: boolean;
  item: boolean;
}

const emptyInput = (): InputState => ({ steer: 0, throttle: 0, brake: 0, drift: false, item: false });

function rollItem(position: number, field: number): PowerId {
  const table: Record<PowerId, [number, number, number]> = {
    banana: [40, 28, 8], shield: [28, 18, 8], magnet: [14, 12, 8], punch: [8, 22, 14],
    freeze: [4, 14, 18], boost: [6, 18, 24], reverse: [6, 14, 12], chicken: [2, 8, 16],
    giant: [0, 4, 10], teleport: [0, 2, 8],
  };
  const bucket = position <= 2 ? 0 : position >= field - 1 ? 2 : 1;
  let total = 0;
  const keys = Object.keys(table) as PowerId[];
  for (const k of keys) total += table[k][bucket];
  let r = Math.random() * total;
  for (const k of keys) {
    r -= table[k][bucket];
    if (r <= 0) return k;
  }
  return "banana";
}

// ============================================================================
// Particles — pooled Points cloud, no per-frame allocation
// ============================================================================
class Particles {
  max = 420;
  geo: THREE.BufferGeometry;
  pts: THREE.Points;
  pos: Float32Array;
  col: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  baseCol: THREE.Color[] = [];
  free: number[] = [];
  constructor(scene: THREE.Scene) {
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    for (let i = 0; i < this.max; i++) {
      this.free.push(i);
      this.pos[i * 3 + 1] = -999;
      this.baseCol.push(new THREE.Color(0xffffff));
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    const mtl = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95 });
    this.pts = new THREE.Points(this.geo, mtl);
    this.pts.frustumCulled = false;
    scene.add(this.pts);
  }
  burst(p: THREE.Vector3, color: string, n: number, speed: number, up: number) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.free.pop();
      if (i === undefined) return;
      this.pos[i * 3] = p.x + rand(-0.3, 0.3);
      this.pos[i * 3 + 1] = Math.max(0.2, p.y) + rand(0, 0.4);
      this.pos[i * 3 + 2] = p.z + rand(-0.3, 0.3);
      const a = Math.random() * TAU;
      const s = rand(0.2, 1) * speed;
      this.vel[i * 3] = Math.cos(a) * s;
      this.vel[i * 3 + 1] = rand(0.35, 1) * up;
      this.vel[i * 3 + 2] = Math.sin(a) * s;
      this.life[i] = rand(0.4, 0.95);
      this.baseCol[i].copy(c);
    }
  }
  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -999;
        this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
        this.free.push(i);
        continue;
      }
      this.vel[i * 3 + 1] -= 15 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = clamp(this.life[i] * 2.4, 0, 1);
      this.col[i * 3] = this.baseCol[i].r * f;
      this.col[i * 3 + 1] = this.baseCol[i].g * f;
      this.col[i * 3 + 2] = this.baseCol[i].b * f;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

// ============================================================================
// Kart
// ============================================================================
let kartUid = 0;

export class Kart {
  id: string;
  name: string;
  isBot: boolean;
  isPlayer: boolean;
  remote = false;
  team: number;
  veh: VehicleDef;
  char: CharacterDef;
  built: BuiltKart;
  color: string;

  pos = new THREE.Vector3();
  yaw = 0;
  y = 0;
  vy = 0;
  grounded = true;
  airTime = 0;
  speed = 0;
  latVel = 0;

  item: PowerId | null = null;

  boostT = 0;
  boostVel = 0;
  drifting = false;
  driftDir = 1;
  driftCharge = 0;
  driftMs = 0;
  spinT = 0;
  frozenT = 0;
  reversedT = 0;
  shieldT = 0;
  giantT = 0;
  magnetT = 0;
  punchT = 0;
  crushSquashT = 0;
  wobbleT = 0;
  bumpCd = 0;
  eggCd = 0;

  lap = 1;
  lcount = 0;
  firstCrossed = false;
  lastIdx = 0;
  progressAbs = 0;
  visitedHalf = false;
  finished = false;
  finishMs = 0;
  eliminated = false;
  coins = 0;
  powerupsUsed = 0;
  lapStartMs = 0;
  bestLapMs: number | null = null;
  wrongWayT = 0;
  rampCd = 0;
  itemCd = 0;
  spinFlipRot = 0;

  maxSpeed: number;
  accel: number;
  turnRate: number;
  mass: number;
  driftStat: number;
  baseMaxSpeed = 0;

  perkExpress: boolean;
  perkEgg: boolean;
  perkHot: boolean;
  perkBubble: boolean;
  perkBurner: boolean;
  perkPotassium: boolean;
  perkBounce: boolean;
  perkCrush: boolean;
  perkGlide: boolean;
  perkArmor: boolean;
  perkKickflip: boolean;
  perkGrass: boolean;
  perkPopUp: boolean;
  perkCaffeine: boolean;
  perkFreezeBump: boolean;
  perkUpdraft: boolean;
  perkTorpedo: boolean;
  perkStomp: boolean;
  perkTractor: boolean;
  perkRichCoins: boolean;

  aiInput: InputState = emptyInput();
  aiSkill = rand(0.86, 1.0);
  aiItemT = rand(1.2, 3.2);
  aiDriftWish = 0;
  punchImmune = 0;
  steerVis = 0;

  netTargetPos: THREE.Vector3 | null = null;
  netTargetYaw = 0;
  netSpeed = 0;
  netScale = 1;

  shieldMesh: THREE.Mesh;
  iceMesh: THREE.Mesh;
  glove: THREE.Group;
  gloveBaseZ = 1.6;
  radius = 1.25;
  scale = 1;
  finishedDance = "";

  upgrades: VehicleUpgrades;

  constructor(opts: {
    name: string; veh: VehicleDef; char: CharacterDef; hat: string; paint: string; wheels: string;
    isBot: boolean; isPlayer: boolean; team: number; upgrades?: VehicleUpgrades;
  }) {
    this.id = "k" + kartUid++;
    this.name = opts.name;
    this.veh = opts.veh;
    this.char = opts.char;
    this.isBot = opts.isBot;
    this.isPlayer = opts.isPlayer;
    this.team = opts.team;
    this.color = opts.paint;
    this.built = buildKart(opts.veh, opts.paint, opts.wheels);
    const driver = buildDriver(opts.char, opts.hat);
    driver.group.position.set(0, 0.35, 0.1);
    this.built.group.add(driver.group);
    this.built.driver = driver.group;
    this.built.driverParts = driver.parts;
    this.shieldMesh = buildShieldBubble();
    this.shieldMesh.visible = false;
    this.shieldMesh.position.y = 1.2;
    this.built.group.add(this.shieldMesh);
    this.iceMesh = buildIceBlock();
    this.iceMesh.visible = false;
    this.iceMesh.position.y = 1.3;
    this.built.group.add(this.iceMesh);
    this.glove = buildGloveMesh();
    this.glove.visible = false;
    this.glove.position.set(0, 1.1, 1.6);
    this.built.group.add(this.glove);

    // Upgrades modify the display stats, which drive the physics constants.
    this.upgrades = opts.upgrades ?? { engine: 0, tires: 0, turbo: 0, frame: 0 };
    const us = upgradedStats(opts.veh, this.upgrades);
    this.maxSpeed = 21 + us.top * 1.7;
    this.accel = 6.5 + us.accel * 1.6;
    this.turnRate = 1.7 + us.handling * 0.19;
    this.mass = 0.6 + us.weight * 0.14;
    this.driftStat = us.drift;
    this.baseMaxSpeed = this.maxSpeed;
    this.perkExpress = opts.veh.id === "shopping-cart";
    this.perkEgg = opts.veh.id === "chicken-bike";
    this.perkHot = opts.veh.id === "pizza-scooter";
    this.perkBubble = opts.veh.id === "bathtub-racer";
    this.perkBurner = opts.veh.id === "rocket-scooter";
    this.perkPotassium = opts.veh.id === "banana-mobile";
    this.perkBounce = opts.veh.id === "rubber-duck";
    this.perkCrush = opts.veh.id === "monster-truck";
    this.perkGlide = opts.veh.id === "flying-carpet" || opts.veh.id === "hot-air-kart";
    this.perkArmor = opts.veh.id === "mini-tank" || opts.veh.id === "submarine";
    this.perkKickflip = opts.veh.id === "skateboard";
    this.perkGrass = opts.veh.id === "lawn-mower";
    this.perkPopUp = opts.veh.id === "toaster-turbo";
    this.perkCaffeine = opts.veh.id === "coffee-cruiser";
    this.perkFreezeBump = opts.veh.id === "ice-cream-truck";
    this.perkUpdraft = opts.veh.id === "hot-air-kart";
    this.perkTorpedo = opts.veh.id === "submarine";
    this.perkStomp = opts.veh.id === "dino-stomper";
    this.perkTractor = opts.veh.id === "ufo-saucer";
    this.perkRichCoins = opts.veh.id === "golden-chariot";
    if (this.perkCrush || opts.veh.id === "mini-tank" || opts.veh.id === "dino-stomper" || opts.veh.id === "ice-cream-truck") this.radius = 1.5;
  }

  forward(out: THREE.Vector3): THREE.Vector3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  spinOut(duration: number, eng: WackyEngine) {
    if (this.eliminated || this.finished || this.remote) return;
    this.spinT = Math.max(this.spinT, duration * (this.perkArmor ? 0.55 : 1));
    this.wobbleT = Math.max(this.wobbleT, 0.9);
    this.drifting = false;
    this.latVel += rand(-9, 9);
    eng.particles.burst(this.pos, "#ffffff", 10, 4, 4);
  }

  applyVisual(dt: number, time: number) {
    const g = this.built.group;
    g.position.copy(this.pos);
    g.position.y += this.y;
    const targetScale = (this.giantT > 0 ? 1.55 : 1) * (this.remote ? this.netScale : 1);
    this.scale += (targetScale - this.scale) * clamp(dt * 6, 0, 1);
    let sq = 1;
    if (this.crushSquashT > 0) sq = 0.55;
    else if (this.wobbleT > 0) sq = 1 - Math.abs(Math.sin(this.wobbleT * 18)) * 0.1 * Math.min(1, this.wobbleT);
    g.scale.set(this.scale * (2 - sq), this.scale * sq, this.scale * (2 - sq));
    let extraYaw = 0;
    if (this.spinT > 0) extraYaw = this.spinT * 11;
    g.rotation.set(0, this.yaw + extraYaw, 0);
    if (this.spinFlipRot > 0 && this.spinFlipRot < TAU) {
      this.spinFlipRot += dt * 10;
      if (this.spinFlipRot >= TAU) this.spinFlipRot = 0;
    }
    if (this.spinFlipRot > 0) g.rotation.x = this.spinFlipRot;
    if (this.drifting && this.grounded) {
      g.rotation.z = this.driftDir * -0.16;
      g.rotation.y += this.driftDir * -0.28;
    }
    if (this.boostT > 0 && this.grounded) g.rotation.x = -0.1;
    const spin = (this.speed * dt) / 0.42;
    this.built.wheels.forEach((w, i) => {
      w.rotation.x += spin;
      if (i < 2) w.rotation.y = this.steerVis * 0.42;
    });
    const dp = this.built.driverParts;
    if (dp.head) dp.head.rotation.z = Math.sin(time * 3 + this.progressAbs * 0.01) * 0.06;
    if (this.wobbleT > 0) {
      if (dp.armL) dp.armL.rotation.set(-1 + Math.sin(this.wobbleT * 30) * 1.4, 0, 0.8);
      if (dp.armR) dp.armR.rotation.set(-1 - Math.sin(this.wobbleT * 26) * 1.4, 0, -0.8);
      if (dp.head) dp.head.rotation.z = Math.sin(this.wobbleT * 24) * 0.4;
    } else if (this.finished && this.finishedDance) {
      this.danceFrame(time, dp);
    } else {
      if (dp.armL) dp.armL.rotation.set(-1, 0, 0.3 + (this.drifting ? 0.4 : 0));
      if (dp.armR) dp.armR.rotation.set(-1, 0, -0.3 - (this.drifting ? 0.4 : 0));
    }
    this.shieldMesh.visible = this.shieldT > 0;
    if (this.shieldT > 0) this.shieldMesh.scale.setScalar(1 + Math.sin(time * 5) * 0.03);
    this.iceMesh.visible = this.frozenT > 0;
    this.built.flame.visible = this.boostT > 0;
    if (this.boostT > 0) {
      this.built.flame.scale.set(1, 1, 1 + Math.random() * 0.5);
      this.built.flame.position.z = -2.15;
    }
    if (this.punchT > 0) {
      this.glove.visible = true;
      const f = 1 - this.punchT / 0.5;
      const ext = f < 0.3 ? f / 0.3 : f > 0.7 ? (1 - f) / 0.3 : 1;
      this.glove.position.z = this.gloveBaseZ + ext * 3.4;
    } else {
      this.glove.visible = false;
    }
  }

  danceFrame(time: number, dp: BuiltKart["driverParts"]) {
    switch (this.finishedDance) {
      case "robot":
        if (dp.armL) dp.armL.rotation.set(-0.4 + (Math.floor(time * 4) % 2) * 1.6, 0, 0.5);
        if (dp.armR) dp.armR.rotation.set(-0.4 + ((Math.floor(time * 4) + 1) % 2) * 1.6, 0, -0.5);
        break;
      case "worm":
        this.built.driver.position.y = 0.3 + Math.abs(Math.sin(time * 6)) * 0.35;
        break;
      case "floss": {
        const s = Math.sin(time * 7);
        if (dp.armL) dp.armL.rotation.set(-1, 0, 0.3 + s);
        if (dp.armR) dp.armR.rotation.set(-1, 0, -0.3 + s);
        break;
      }
      default:
        this.built.driver.rotation.y = time * 6;
        if (dp.armL) dp.armL.rotation.set(-Math.PI, 0, 0.6);
        if (dp.armR) dp.armR.rotation.set(-Math.PI, 0, -0.6);
    }
  }
}

// ============================================================================
interface Hazard { kind: "banana" | "egg"; mesh: THREE.Group; pos: THREE.Vector3; owner: string; age: number; }
interface Chicken { mesh: THREE.Group; pos: THREE.Vector3; targetId: string; owner: string; ownerName: string; age: number; }

// ============================================================================
// Engine
// ============================================================================
export interface EngineConfig {
  canvas: HTMLCanvasElement;
  setup: RaceSetup;
  garage: GarageSel;
  playerName: string;
  settings: { quality: "auto" | "high" | "low"; shake: boolean };
  controls: { keys: KeyBindings; sensitivity: number };
  upgrades?: UpgradeMap;
  onFinish: (s: RaceSummary) => void;
  onQuit: () => void;
}

type NetMsg = { t: string } & Record<string, unknown>;

export class WackyEngine {
  cfg: EngineConfig;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  track!: BuiltTrack;
  def: TrackDef;
  karts: Kart[] = [];
  player!: Kart;
  hazards: Hazard[] = [];
  chickens: Chicken[] = [];
  pickups: { mesh: THREE.Group; pos: THREE.Vector3; respawnT: number }[] = [];
  coins: { mesh: THREE.Object3D; pos: THREE.Vector3; taken: boolean }[] = [];
  particles!: Particles;
  keys: Record<string, boolean> = {};
  touch: InputState = emptyInput();
  running = true;
  paused = false;
  phase: "countdown" | "racing" | "over" = "countdown";
  countdownT = 3.4;
  lastBeep = 4;
  raceMs = 0;
  time = 0;
  raf = 0;
  last = 0;
  camShake = 0;
  fov = 62;
  laps: number;
  mode: string;
  hudTick = 0;
  resultsAtMs = -1;
  elimLap = 1;
  chaosT = 14;
  chaosScale = 1;
  chaosGrav = 1;
  chaosModT = 0;
  rouletteT = 0;
  rouletteItem: PowerId | null = null;
  net: NetRoomInfo | null;
  netTick = 0;
  remotesById = new Map<string, Kart>();
  disposers: (() => void)[] = [];
  onPauseChange?: (p: boolean) => void;
  goT = -1;
  hudTimer = 0;
  keyMap: Record<string, string> = {};
  steerSmooth = 0;
  tiltVal = 0;
  v1 = new THREE.Vector3();
  v2 = new THREE.Vector3();
  v3 = new THREE.Vector3();
  elimDeadline = -1;
  finTimeout = -1;
  results: { name: string; ms: number | null; isPlayer: boolean; isBot: boolean; id: string }[] = [];
  gotResults = false;
  sun!: THREE.DirectionalLight;

  constructor(cfg: EngineConfig) {
    this.cfg = cfg;
    this.mode = cfg.setup.mode;
    this.net = cfg.setup.net ?? null;
    this.def = TRACKS.find((t) => t.id === cfg.setup.track) ?? TRACKS[0];
    // key bindings: code -> action
    for (const [action, code] of Object.entries(cfg.controls.keys)) this.keyMap[code] = action;
    const modeDef = MODES.find((m) => m.id === this.mode) ?? MODES[0];
    this.laps = this.mode === "time-trial" ? this.def.laps + 2
      : this.mode === "elimination" ? this.def.laps + 2
      : modeDef.laps === "track" ? this.def.laps : (modeDef.laps as number);

    this.renderer = new THREE.WebGLRenderer({ canvas: cfg.canvas, antialias: cfg.settings.quality !== "low", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(cfg.settings.quality === "low" ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(cfg.canvas.clientWidth || window.innerWidth, cfg.canvas.clientHeight || window.innerHeight, false);
    this.renderer.shadowMap.enabled = cfg.settings.quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1500);
    const hemi = new THREE.HemisphereLight(this.def.theme.sky, this.def.theme.ground, 1.15);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff6e3", 1.8);
    this.sun = sun;
    const cx = this.def.points.reduce((a, p) => a + p[0], 0) / this.def.points.length;
    const cz = this.def.points.reduce((a, p) => a + p[1], 0) / this.def.points.length;
    sun.position.set(cx + 80, 150, cz + 60);
    sun.target.position.set(cx, 0, cz);
    sun.castShadow = cfg.settings.quality !== "low";
    sun.shadow.mapSize.set(2048, 2048);
    const R = 175;
    sun.shadow.camera.left = -R; sun.shadow.camera.right = R;
    sun.shadow.camera.top = R; sun.shadow.camera.bottom = -R;
    sun.shadow.camera.far = 500;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun, sun.target);
    this.scene.background = new THREE.Color(this.def.theme.sky);
    this.scene.fog = new THREE.Fog(this.def.theme.fog, this.def.theme.fogNear, this.def.theme.fogFar);

    this.track = buildTrack(this.def);
    this.scene.add(this.track.group);
    this.particles = new Particles(this.scene);

    const horizon = new THREE.Mesh(
      new THREE.CylinderGeometry(850, 850, 260, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: this.def.theme.horizon, side: THREE.BackSide, fog: false }),
    );
    horizon.position.y = 30;
    this.scene.add(horizon);

    const pickupRows = this.mode === "chaos" ? 2 : 1;
    for (let r = 0; r < pickupRows; r++) {
      for (const p of this.track.pickupSpots) {
        const mesh = buildPickupBox();
        const off = r === 0 ? 0 : 6.2;
        const pos = p.clone().addScaledVector(this.track.samples[0].tan, 0);
        // offset second chaos row forward along track
        if (r === 1) {
          const near = this.nearestSampleIdx(p);
          pos.copy(this.track.samples[(near + 18) % this.track.samples.length].pos);
        }
        mesh.position.copy(pos).setY(1.2);
        this.scene.add(mesh);
        this.pickups.push({ mesh, pos, respawnT: 0 });
        void off;
      }
    }
    for (const p of this.track.coinSpots) {
      const mesh = buildCoinMesh();
      mesh.position.copy(p);
      this.scene.add(mesh);
      this.coins.push({ mesh, pos: p.clone(), taken: false });
    }

    this.spawnKarts();

    const kd = (e: KeyboardEvent) => this.onKey(e, true);
    const ku = (e: KeyboardEvent) => this.onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    this.disposers.push(() => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); });
    const rs = () => this.resize();
    window.addEventListener("resize", rs);
    this.disposers.push(() => window.removeEventListener("resize", rs));
    this.resize();

    AudioMan.startEngine();
    AudioMan.startMusic("race");
    if (this.net) this.wireNet();

    const hud = useHud.getState();
    hud.set({
      lap: 1, lapsTotal: this.mode === "practice" ? 0 : this.laps, countdown: 3,
      position: this.karts.length, fieldSize: this.karts.length, item: null, itemRolling: false,
      bestLapMs: null, coins: 0, feed: [], finished: false, chaosEvent: null, wrongWay: false,
      speed: 0, boostCharge: 0, boosting: false, raceTimeMs: 0, lapTimeMs: 0,
      frozen: false, reversed: false, shielded: false, giant: false, offTrack: false, racers: [],
    });
    const intro: Record<string, string> = {
      quick: "CPU rivals are clearly labeled (CPU). Beat them to the line!",
      grandprix: `Grand Prix race ${(this.cfg.setup.gpRace ?? 0) + 1} of 3 — points decide the cup!`,
      elimination: "Last place is ELIMINATED every lap. Survive!",
      team: "3v3 teams! Team points decide it — help your squad!",
      chaos: "CHAOS MODE: wild events every 15 seconds. Buckle up.",
      "time-trial": `${this.laps} flying laps. The leaderboard awaits!`,
      practice: "Free roam — practice lines, jumps and items. Esc to pause.",
      multiplayer: "Online friends room — real people, real chaos!",
    };
    hud.pushFeed(intro[this.mode] ?? "Race!", "#ffd23f");

    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = clamp((t - this.last) / 1000, 0.001, 0.05);
      this.last = t;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // -------------------------------------------------------------------------
  onKey(e: KeyboardEvent, down: boolean) {
    if (e.repeat && down) return;
    this.keys[e.code] = down;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    if (down && e.code === "Escape") this.togglePause();
    const action = this.keyMap[e.code];
    if (down && action === "item") this.playerUseItem();
    if (down && action === "horn" && !this.paused) AudioMan.horn(this.cfg.garage.horn);
  }

  setTouchInput(p: Partial<InputState>) {
    this.touch = { ...this.touch, ...p };
    if (p.item) this.playerUseItem();
  }

  /** gyro steering feed from the race screen (-1..1) */
  setTilt(v: number) {
    this.tiltVal = clamp(v, -1, 1);
  }

  togglePause() {
    if (this.phase === "over") return;
    this.paused = !this.paused;
    if (this.paused) { AudioMan.stopDrift(); AudioMan.stopBoost(); AudioMan.setEngine(0, 0); AudioMan.stopMusic(); }
    else AudioMan.startMusic("race");
    this.onPauseChange?.(this.paused);
    useHud.getState().pushFeed(this.paused ? "Paused" : "Go go go!", "#ffffff");
  }

  resize() {
    const c = this.cfg.canvas;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // -------------------------------------------------------------------------
  spawnKarts() {
    const g = this.cfg.garage;
    const vehDef = (id: string) => VEHICLES.find((v) => v.id === id) ?? VEHICLES[0];
    const charDef = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
    const modeDef = MODES.find((m) => m.id === this.mode) ?? MODES[0];
    const field = clamp(modeDef.racers, 1, 8);
    const paints = ["#2e86ab", "#28c76f", "#a06cd5", "#ff5ca8", "#ffd23f", "#f28f3b", "#00d4d8", "#f5f5f5"];
    const N = this.track.samples.length;

    const mkKart = (name: string, vehId: string, chId: string, hat: string, paint: string, wheels: string, isBot: boolean, isPlayer: boolean) =>
      new Kart({
        name, veh: vehDef(vehId), char: charDef(chId), hat, paint, wheels, isBot, isPlayer, team: -1,
        upgrades: isPlayer ? getUpgrades(this.cfg.upgrades, vehId) : undefined,
      });

    this.player = mkKart(this.cfg.playerName, g.vehicle, g.character, g.hat, g.paint, g.wheels, false, true);
    this.player.id = this.net ? `peer-${this.net.selfPeerId}` : "player";
    this.karts.push(this.player);

    if (this.net) {
      for (const peer of this.net.peers) {
        const k = mkKart(peer.name, peer.vehicle, peer.character, "party", peer.paint, "classic", false, false);
        k.remote = true;
        k.id = `peer-${peer.id}`;
        this.remotesById.set(k.id, k);
        this.karts.push(k);
      }
    }

    const isGuest = !!this.net?.selfIsGuest;
    if (this.net?.bots) {
      // Multiplayer: identical bot roster on host & guests. Host simulates;
      // guests display them as remote karts synced over the wire.
      this.net.bots.forEach((bd, i) => {
        const k = mkKart(bd.name, bd.vehicle, bd.character, "party", bd.paint, "classic", true, false);
        k.id = `bot-${i}`;
        k.remote = isGuest;
        this.karts.push(k);
      });
    } else {
      const botCount = Math.max(0, field - this.karts.length);
      const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
      for (let i = 0; i < botCount; i++) {
        const bv = VEHICLES[Math.floor(Math.random() * VEHICLES.length)];
        const bc = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        const hat = HATS[Math.floor(Math.random() * (HATS.length - 1)) + 1];
        const k = mkKart(`${names[i % names.length]} (CPU)`, bv.id, bc.id, hat.id, paints[i % paints.length], "classic", true, false);
        k.id = `bot-${i}`;
        this.karts.push(k);
      }
    }

    if (this.mode === "team") this.karts.forEach((k, i) => { k.team = i % 2; });

    // start grid: two per row behind the line, player last for drama
    const grid = [...this.karts.filter((k) => !k.isPlayer), this.player];
    grid.forEach((k, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2 === 0 ? -1 : 1;
      const si = (N - 10 - row * 9 + N) % N;
      const s = this.track.samples[si];
      k.pos.copy(s.pos).addScaledVector(s.lat, col * this.def.width * 0.23);
      k.yaw = s.yaw;
      k.lastIdx = si;
      k.progressAbs = -((10 + row * 9));
      k.lapStartMs = 0;
      this.scene.add(k.built.group);
      k.applyVisual(0.016, 0);
    });
    this.results = this.karts.map((k) => ({ name: k.name, ms: null, isPlayer: k.isPlayer, isBot: k.isBot, id: k.id }));
  }

  // ==========================================================================
  // MASTER UPDATE
  // ==========================================================================
  update(dt: number) {
    this.time += dt;
    if (this.paused) { this.renderCam(dt, true); return; }

    // countdown
    if (this.phase === "countdown") {
      this.countdownT -= dt;
      const c = Math.ceil(this.countdownT);
      if (c !== this.lastBeep && c >= 0) {
        this.lastBeep = c;
        if (c >= 1) AudioMan.countBeep(false);
        else AudioMan.go();
        useHud.getState().set({ countdown: c >= 1 ? c : 0 });
      }
      if (this.countdownT <= 0) {
        this.phase = "racing";
        this.goT = 0.95;
      }
      this.animateWorld(dt);
      this.renderCam(dt, false);
      this.pushHud();
      return;
    }
    if (this.phase !== "racing") { this.animateWorld(dt); this.renderCam(dt, true); this.particles.update(dt); return; }

    if (this.goT > 0) {
      this.goT -= dt;
      if (this.goT <= 0) useHud.getState().set({ countdown: -1 });
    }
    this.raceMs += dt * 1000;

    // inputs
    const playerInput = this.playerInput(dt);
    this.player.steerVis = playerInput.steer;
    this.stepKart(this.player, playerInput, dt);
    for (const k of this.karts) {
      if (k.isPlayer || k.remote || k.eliminated) continue;
      this.botInput(k, dt);
      this.stepKart(k, k.aiInput, dt);
    }
    for (const k of this.karts) {
      if (k.remote && !k.eliminated) this.stepRemote(k, dt);
    }

    // collisions between karts
    this.kartCollisions(dt);
    // interactions
    this.trackInteractions(dt);
    // mode logic
    this.modeLogic(dt);
    // chaos
    if (this.mode === "chaos") this.chaosLogic(dt);
    // world anim
    this.animateWorld(dt);
    // hazards & chickens
    this.updateHazards(dt);
    this.updateChickens(dt);
    // roulette
    this.roulette(dt);
    // net
    if (this.net) this.netUpdate(dt);
    // audio
    this.audioUpdate();
    // camera
    this.renderCam(dt, false);
    this.particles.update(dt);
    // hud
    this.pushHud();
  }

  // ==========================================================================
  // INPUT
  // ==========================================================================
  playerInput(dt: number): InputState {
    const k = this.keys, t = this.touch;
    const b = this.cfg.controls.keys;
    let steer = 0;
    if (k[b.left] || k["ArrowLeft"]) steer -= 1;
    if (k[b.right] || k["ArrowRight"]) steer += 1;
    steer += t.steer;
    if (Math.abs(this.tiltVal) > 0.06) steer += this.tiltVal;
    steer = clamp(steer, -1, 1);
    // steering response: smooth digital inputs, higher sensitivity = snappier
    const rate = 11 * this.cfg.controls.sensitivity;
    this.steerSmooth += (steer - this.steerSmooth) * clamp(rate * dt, 0, 1);
    if (Math.abs(this.steerSmooth - steer) < 0.01) this.steerSmooth = steer;
    steer = this.steerSmooth;
    if (this.player.reversedT > 0) steer = -steer;
    let throttle = 0;
    if (k[b.accel] || k["ArrowUp"]) throttle = 1;
    throttle = Math.max(throttle, t.throttle);
    let brake = 0;
    if (k[b.brake] || k["ArrowDown"]) brake = 1;
    brake = Math.max(brake, t.brake);
    const drift = !!(k[b.drift] || t.drift);
    return { steer, throttle, brake, drift, item: false };
  }

  botInput(k: Kart, dt: number) {
    const samples = this.track.samples;
    const N = samples.length;
    const look = 14 + Math.abs(k.speed) * 0.55;
    const targetIdx = (k.lastIdx + Math.floor(look)) % N;
    const tp = samples[targetIdx].pos;
    const desired = Math.atan2(tp.x - k.pos.x, tp.z - k.pos.z);
    const diff = angDiff(desired, k.yaw);
    const inp = k.aiInput;
    inp.steer = clamp(diff * 2.4, -1, 1);
    if (k.reversedT > 0) inp.steer = -inp.steer;
    const corner = Math.abs(diff);
    inp.throttle = k.finished ? 0.15 : corner > 1.15 ? 0.25 : 1;
    inp.brake = corner > 1.3 && k.speed > k.maxSpeed * 0.55 ? 0.8 : 0;
    // drift on corners
    if (corner > 0.5 && k.speed > 16 && Math.random() < dt * 4) k.aiDriftWish = rand(0.5, 1.3);
    if (k.aiDriftWish > 0) {
      k.aiDriftWish -= dt;
      inp.drift = true;
    } else inp.drift = false;
    // avoid hazards
    for (const h of this.hazards) {
      const d = this.v1.subVectors(h.pos, k.pos);
      const distSq = d.lengthSq();
      if (distSq < 81) {
        const fwd = k.forward(this.v2);
        if (d.dot(fwd) > 0) inp.steer += clamp((fwd.x * d.z - fwd.z * d.x) * 0.09, -0.7, 0.7) * (d.x * k.pos.z > 0 ? 1 : 1);
      }
    }
    // use items
    if (k.item && !k.finished && this.phase === "racing") {
      k.aiItemT -= dt;
      if (k.aiItemT <= 0) {
        this.executeItem(k, k.item);
        k.item = null;
        k.aiItemT = rand(1.5, 4);
      }
    }
    // rubber-band: gentle assist based on distance to player
    const gap = this.player.progressAbs - k.progressAbs;
    const band = clamp(1 + (gap / this.track.length) * 0.35, 0.9, 1.12);
    k.maxSpeed = k.baseMaxSpeed * k.aiSkill * band;
  }

  // ==========================================================================
  // PHYSICS
  // ==========================================================================
  stepKart(k: Kart, inp: InputState, dt: number) {
    if (k.eliminated) return;
    const N = this.track.samples.length;
    const slippery = this.def.slippery;
    const boosting = k.boostT > 0;
    if (k.boostT > 0) k.boostT -= dt;

    // timers
    k.spinT = Math.max(0, k.spinT - dt);
    k.frozenT = Math.max(0, k.frozenT - dt);
    k.reversedT = Math.max(0, k.reversedT - dt);
    k.shieldT = Math.max(0, k.shieldT - dt);
    k.giantT = Math.max(0, k.giantT - dt);
    k.magnetT = Math.max(0, k.magnetT - dt);
    k.punchT = Math.max(0, k.punchT - dt);
    k.wobbleT = Math.max(0, k.wobbleT - dt);
    k.crushSquashT = Math.max(0, k.crushSquashT - dt);
    k.bumpCd = Math.max(0, k.bumpCd - dt);
    k.eggCd = Math.max(0, k.eggCd - dt);
    k.rampCd = Math.max(0, k.rampCd - dt);
    k.itemCd = Math.max(0, k.itemCd - dt);

    const locked = this.phase !== "racing" || k.spinT > 0 || k.finished;
    const giantBoost = k.giantT > 0 ? 1.1 : 1;
    const frozenMul = k.frozenT > 0 ? 0.34 : 1;
    const burner = k.perkBurner ? 1.4 : 1;
    const hotLap = k.perkHot && k.lap === 1 ? 1.16 : 1;

    // speed
    const boostVel = boosting ? (10 * burner) : 0;
    k.boostVel = boostVel;
    const maxSpd = k.maxSpeed * giantBoost * frozenMul + boostVel;
    if (!locked && inp.throttle > 0) {
      k.speed += this.accelOf(k) * hotLap * frozenMul * inp.throttle * dt;
    } else if (!locked && inp.brake > 0) {
      k.speed -= 16 * inp.brake * dt;
      if (k.speed < -8) k.speed = -8;
    } else {
      const drag = k.grounded ? 3.2 : 0.6;
      k.speed -= Math.sign(k.speed) * Math.min(Math.abs(k.speed), drag * dt);
    }
    if (boosting) k.speed = Math.min(maxSpd, k.speed + (k.accel + 20) * dt);
    k.speed = clamp(k.speed, -9, maxSpd);

    // drifting
    const wasDrifting = k.drifting;
    // Toaster Turbo: pop-up launch when drifting at low speed
    if (!locked && inp.drift && k.grounded && k.perkPopUp && k.speed < 9 && k.rampCd <= 0) {
      k.grounded = false;
      k.vy = 9.5;
      k.y = 0.12;
      k.rampCd = 1.6;
      k.speed = Math.min(k.maxSpeed, k.speed + 7);
      if (k.isPlayer) { AudioMan.boing(); useHud.getState().pushFeed("POP-UP LAUNCH! Toast away!", "#ffd23f"); }
      this.particles.burst(k.pos, "#d9a441", 10, 4, 6);
    }
    if (!locked && inp.drift && k.grounded && k.speed > 9 && !k.drifting) {
      k.drifting = true;
      k.driftDir = inp.steer !== 0 ? Math.sign(inp.steer) : k.driftDir;
      k.driftCharge = 0;
      if (k.isPlayer) AudioMan.startDrift();
    }
    if (k.drifting && (!inp.drift || !k.grounded || k.speed < 6 || locked)) {
      k.drifting = false;
      if (k.isPlayer) AudioMan.stopDrift();
      if (k.driftCharge > 0.45 && !locked) {
        const power = (k.driftCharge > 1 ? 1.7 : 1) * (k.perkPotassium ? 1.5 : 1);
        k.boostT = Math.max(k.boostT, 0.9 * power);
        if (k.perkBubble && k.driftCharge > 0.9 && Math.random() < 0.35) {
          k.shieldT = Math.max(k.shieldT, 3);
          if (k.isPlayer) { AudioMan.shieldOn(); useHud.getState().pushFeed("Bubble Bath bonus shield!", "#66e0ff"); }
        }
        this.particles.burst(k.pos, "#ffd23f", 10, 3, 4);
      }
      k.driftCharge = 0;
    }
    if (k.drifting) {
      k.driftCharge += dt * (0.55 + k.driftStat * 0.055);
      k.driftMs += dt * 1000;
      if (k.isPlayer && Math.random() < dt * 30) {
        this.v1.copy(k.pos).addScaledVector(k.forward(this.v2), -1.4);
        this.particles.burst(this.v1, k.driftCharge > 1 ? "#66e0ff" : "#ff7f2a", 2, 2, 2.5);
      }
      // chicken-bike egg perk
      if (k.perkEgg && k.eggCd <= 0 && Math.random() < dt * 0.55) {
        this.dropHazard(k, "egg");
        k.eggCd = 3;
      }
    }

    // steering
    const steerMul = (k.drifting ? 1.5 : 1) * (k.frozenT > 0 ? 1.15 : 1) * (1 - slippery * 0.3);
    const spdFactor = clamp(Math.abs(k.speed) / 12, 0, 1);
    const airControl = k.grounded ? 1 : k.perkGlide ? 0.85 : 0.35;
    if (!locked && k.speed !== 0) {
      k.yaw += inp.steer * k.turnRate * spdFactor * steerMul * airControl * dt * (k.speed < 0 ? -1 : 1);
    }

    // lateral velocity (drift slide / bumps)
    if (k.drifting && k.grounded) {
      const lat = this.v3.set(Math.cos(k.yaw), 0, -Math.sin(k.yaw));
      k.latVel += (-k.driftDir * Math.cos(k.drifting ? 0.5 : 0)) * 4 * dt;
      k.latVel = clamp(k.latVel, -6.5, 6.5);
      void lat;
    }
    const latDecay = k.grounded ? (k.drifting ? 3 : 10 - slippery * 6.5) : 0.5;
    k.latVel -= k.latVel * clamp(latDecay * dt, 0, 0.9);

    // gravity & jumps
    const grav = (k.perkGlide ? 13 : 22) * this.chaosGrav;
    if (!k.grounded) {
      k.vy -= grav * dt;
      k.y += k.vy * dt;
      k.airTime += dt;
      if (k.y <= 0) {
        k.y = 0;
        k.vy = 0;
        k.grounded = true;
        k.crushSquashT = 0.14;
        // Dino Stomper: landing shockwave knocks nearby rivals flying
        if (k.perkStomp && k.airTime > 0.45) {
          for (const o of this.karts) {
            if (o === k || o.remote || o.eliminated) continue;
            const dx = o.pos.x - k.pos.x, dz = o.pos.z - k.pos.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < 90) {
              const d = Math.sqrt(d2) || 1;
              o.latVel += (dx / d) * 11;
              o.wobbleT = Math.max(o.wobbleT, 1);
              o.speed *= 0.7;
              if (o.isPlayer) { this.camShake = 0.8; useHud.getState().pushFeed(`${k.name} STOMPED the ground!`, "#3ddc84"); }
            }
          }
          AudioMan.crash();
          this.particles.burst(k.pos, "#3ddc84", 20, 8, 4);
          if (k.isPlayer) { this.camShake = 0.7; useHud.getState().pushFeed("PREHISTORIC STOMP!", "#3ddc84"); }
        }
        if (k.airTime > 0.55 && k.drifting) k.spinFlipRot = 0.001;
        if (k.airTime > 0.5) {
          this.particles.burst(k.pos, "#ffffff", 8, 3, 3);
          if (k.isPlayer) AudioMan.bump();
        }
        k.airTime = 0;
      }
    }

    // move
    const fwd = k.forward(this.v1);
    const latv = this.v2.set(fwd.z, 0, -fwd.x);
    k.pos.addScaledVector(fwd, k.speed * dt);
    k.pos.addScaledVector(latv, k.latVel * dt * (k.perkCrush ? 0.7 : 1));

    // follow track (nearest sample + progress + walls)
    this.trackFollow(k, dt);
    // ramps
    this.rampCheck(k);

    // punch hit check
    if (k.punchT > 0) this.punchCheck(k);

    k.applyVisual(dt, this.time);
  }

  accelOf(k: Kart) { return k.accel; }

  nearestSampleIdx(p: THREE.Vector3): number {
    let best = 0, bestD = Infinity;
    const samples = this.track.samples;
    for (let i = 0; i < samples.length; i += 4) {
      const dx = samples[i].pos.x - p.x, dz = samples[i].pos.z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  trackFollow(k: Kart, dt: number) {
    const samples = this.track.samples;
    const N = samples.length;
    // local search around lastIdx
    let bestIdx = k.lastIdx, bestD = Infinity;
    for (let off = -30; off <= 70; off += 2) {
      const i = (k.lastIdx + off + N) % N;
      const s = samples[i];
      const dx = s.pos.x - k.pos.x, dz = s.pos.z - k.pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    // checkpoint: visited halfway
    if (bestIdx > N * 0.3 && bestIdx < N * 0.8) k.visitedHalf = true;
    // crossed start line forward?
    if (k.lastIdx > N - 40 && bestIdx < 40 && k.speed > 2) {
      if (!k.firstCrossed) {
        k.firstCrossed = true;
        k.lapStartMs = this.raceMs;
      } else if (k.visitedHalf && !k.finished && !k.eliminated) {
        this.onLapComplete(k);
      }
      k.visitedHalf = false;
      k.lcount++;
    }
    k.lastIdx = bestIdx;
    const s = samples[bestIdx];
    // lateral offset
    const latOff = (k.pos.x - s.pos.x) * s.lat.x + (k.pos.z - s.pos.z) * s.lat.z;
    const hw = s.width / 2;
    const offTrack = Math.abs(latOff) > hw - 0.35;
    if (offTrack) {
      // Lawn Mower laughs at grass
      k.speed -= Math.sign(k.speed) * Math.min(Math.abs(k.speed), (k.perkGrass ? 3.2 : 10) * dt);
      if (k.grounded && Math.abs(k.speed) > 6 && Math.random() < dt * 20) {
        this.v1.copy(k.pos);
        this.particles.burst(this.v1, this.def.theme.ground, 2, 3, 2.5);
      }
    }
    // hard wall bounce
    const wall = hw + 1.6;
    if (Math.abs(latOff) > wall) {
      const over = Math.abs(latOff) - wall;
      k.pos.addScaledVector(s.lat, -Math.sign(latOff) * over);
      if (k.bumpCd <= 0 && Math.abs(k.latVel) + Math.abs(k.speed) * 0.25 > 6) {
        k.bumpCd = 0.35;
        k.wobbleT = 0.7;
        if (k.perkBounce) {
          k.speed = Math.min(k.maxSpeed, Math.abs(k.speed) + 4);
          if (k.isPlayer) { AudioMan.boing(); useHud.getState().pushFeed("Squeaky bounce!", "#ffd23f"); }
        } else {
          k.speed *= 0.82;
          if (k.isPlayer) { AudioMan.bump(); this.camShake = Math.max(this.camShake, 0.35); }
        }
        k.latVel = -Math.sign(latOff) * Math.abs(k.latVel) * 0.55;
      }
      k.latVel = clamp(k.latVel, -14, 14);
    }
    k.progressAbs = k.lcount * N + bestIdx;
    // wrong-way detection
    const fwd = k.forward(this.v1);
    if (!k.isBot && k.speed > 5 && fwd.dot(s.tan) < -0.4) {
      k.wrongWayT += dt;
      if (k.wrongWayT > 1 && this.wrongSfxCd <= 0) { AudioMan.wrongway(); this.wrongSfxCd = 2.4; }
    } else k.wrongWayT = Math.max(0, k.wrongWayT - dt * 2);
    this.wrongSfxCd = Math.max(0, (this.wrongSfxCd ?? 0) - dt);
    // store offTrack for hud
    if (k.isPlayer) this.playerOffTrack = offTrack;
  }

  wrongSfxCd = 0;
  playerOffTrack = false;

  rampCheck(k: Kart) {
    if (!k.grounded || k.rampCd > 0) return;
    for (const r of this.track.ramps) {
      const dx = k.pos.x - r.center.x, dz = k.pos.z - r.center.z;
      const along = dx * r.tan.x + dz * r.tan.z;
      const lat = dx * r.lat.x + dz * r.lat.z;
      if (Math.abs(along) < 2.8 && Math.abs(lat) < 2.9 && k.speed > 5) {
        k.grounded = false;
        k.vy = 8.5 + Math.abs(k.speed) * 0.22;
        k.y = 0.15;
        k.rampCd = 1.1;
        k.airTime = 0;
        if (k.perkKickflip) {
          // Skateboard: higher launches + instant trick boost
          k.vy *= 1.3;
          k.boostT = Math.max(k.boostT, 0.85);
          k.spinFlipRot = 0.001;
          if (k.isPlayer) useHud.getState().pushFeed("KICKFLIP! Trick boost!", "#ff5ca8");
        }
        if (k.isPlayer) { AudioMan.boing(); this.camShake = Math.max(this.camShake, 0.2); }
        this.particles.burst(k.pos, "#b6f34d", 10, 4, 5);
      }
    }
  }

  onLapComplete(k: Kart) {
    const lapMs = this.raceMs - k.lapStartMs;
    k.lapStartMs = this.raceMs;
    if (k.lap > 0 && lapMs > 5000) {
      if (k.bestLapMs === null || lapMs < k.bestLapMs) k.bestLapMs = lapMs;
      if (k.isPlayer) {
        const hud = useHud.getState();
        hud.set({ bestLapMs: k.bestLapMs });
        AudioMan.lap();
        const isBest = this.karts.every((o) => o === k || o.bestLapMs === null || lapMs <= o.bestLapMs);
        hud.pushFeed(isBest ? `Lap ${k.lap} — fastest lap!` : `Lap ${k.lap} complete!`, "#64ffda");
      }
    }
    k.lap++;
    if (this.mode !== "practice" && k.lap > this.laps && !k.finished) {
      k.finished = true;
      k.finishMs = this.raceMs;
      k.finishedDance = k.isPlayer ? this.cfg.garage.dance : ["spin", "robot", "worm", "floss"][Math.floor(Math.random() * 4)];
      const pos = this.karts.filter((o) => o.finished).length;
      if (k.isPlayer) {
        AudioMan.victoryFanfare();
        useHud.getState().set({ finished: true });
        useHud.getState().pushFeed(pos === 1 ? "YOU WIN! Victory lap!" : `Finished P${pos}!`, pos === 1 ? "#ffd23f" : "#ffffff");
        if (pos === 1) AudioMan.cheer();
        this.finTimeout = this.raceMs + 8000;
        // confetti
        for (let i = 0; i < 6; i++) {
          this.v1.copy(k.pos).add(this.v2.set(rand(-3, 3), rand(1, 4), rand(-3, 3)));
          this.particles.burst(this.v1, ["#ff5ca8", "#ffd23f", "#66e0ff", "#b6f34d"][i % 4], 18, 5, 8);
        }
      }
      if (this.net && (k.isPlayer || k.isBot)) {
        this.net.room.send({ t: "fin", ms: k.finishMs, id: k.id, name: k.name });
        if (!this.net.selfIsGuest) this.hostCheckResults();
      }
      const rec = this.results.find((r) => r.id === k.id);
      if (rec && rec.ms === null) rec.ms = k.finishMs;
    }
  }

  // ==========================================================================
  // COLLISIONS & INTERACTIONS
  // ==========================================================================
  kartCollisions(dt: number) {
    const ks = this.karts;
    for (let i = 0; i < ks.length; i++) {
      const a = ks[i];
      if (a.eliminated) continue;
      for (let j = i + 1; j < ks.length; j++) {
        const b = ks[j];
        if (b.eliminated) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const rr = (a.radius * a.scale + b.radius * b.scale);
        const dSq = dx * dx + dz * dz;
        if (dSq > rr * rr || dSq < 0.0001) continue;
        const d = Math.sqrt(dSq);
        const nx = dx / d, nz = dz / d;
        const overlap = rr - d;
        const totalMass = a.mass + b.mass;
        // push apart
        const pa = overlap * (b.mass / totalMass), pb = overlap * (a.mass / totalMass);
        if (!a.remote) { a.pos.x -= nx * pa; a.pos.z -= nz * pa; }
        if (!b.remote) { b.pos.x += nx * pb; b.pos.z += nz * pb; }
        // giant crush
        for (const [big, small] of [[a, b], [b, a]] as [Kart, Kart][]) {
          if (big.giantT > 0 && !small.remote && small.giantT <= 0 && small.crushSquashT <= 0) {
            small.crushSquashT = 0.7;
            small.spinOut(1.0, this);
            small.speed *= 0.3;
            this.particles.burst(small.pos, "#b6f34d", 14, 5, 5);
            if (small.isPlayer || big.isPlayer) { AudioMan.crash(); this.camShake = 0.5; }
            if (big.isPlayer) useHud.getState().pushFeed(`You squashed ${small.name}!`, "#b6f34d");
            if (small.isPlayer) useHud.getState().pushFeed(`Squashed by ${big.name}!`, "#ff4d6d");
          }
        }
        // speed exchange + bump feel
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 7 && (a.bumpCd <= 0 || b.bumpCd <= 0)) {
          a.wobbleT = Math.max(a.wobbleT, 0.6);
          b.wobbleT = Math.max(b.wobbleT, 0.6);
          a.bumpCd = b.bumpCd = 0.5;
          // Ice Cream Truck gives bumpers brain freeze
          for (const [self, other] of [[a, b], [b, a]] as [Kart, Kart][]) {
            if (self.perkFreezeBump && !other.remote && other.frozenT <= 0) {
              other.frozenT = Math.max(other.frozenT, other.perkArmor ? 0.5 : 1.3);
              if (other.isPlayer) useHud.getState().pushFeed(`Brain freeze from ${self.name}!`, "#9bf0ff");
              if (self.isPlayer) useHud.getState().pushFeed(`Brain-froze ${other.name}!`, "#9bf0ff");
            }
          }
          const knockA = (b.mass / totalMass) * 6 * (b.perkCrush ? 1.7 : 1);
          const knockB = (a.mass / totalMass) * 6 * (a.perkCrush ? 1.7 : 1);
          if (!a.remote) a.latVel -= knockA * rand(0.6, 1);
          if (!b.remote) b.latVel += knockB * rand(0.6, 1);
          a.speed *= 0.86;
          b.speed *= 0.86;
          if (a.isPlayer || b.isPlayer) {
            AudioMan.crash();
            this.camShake = Math.max(this.camShake, 0.45);
          }
          this.v1.copy(a.pos).lerp(b.pos, 0.5);
          this.particles.burst(this.v1.setY(1), "#ffd23f", 12, 5, 5);
        }
        void dt;
      }
    }
  }

  trackInteractions(dt: number) {
    // pickups
    for (const p of this.pickups) {
      if (p.respawnT > 0) {
        p.respawnT -= dt;
        p.mesh.visible = p.respawnT <= 0;
        p.mesh.scale.setScalar(p.respawnT > 0 ? 1 : 1);
        if (p.respawnT <= 0) { p.mesh.scale.setScalar(1); }
      } else {
        p.mesh.rotation.y += dt * 1.8;
        p.mesh.position.y = 1.2 + Math.sin(this.time * 3 + p.pos.x) * 0.18;
        for (const k of this.karts) {
          if (k.remote || k.eliminated || k.finished || k.item) continue;
          const dx = k.pos.x - p.pos.x, dz = k.pos.z - p.pos.z;
          // UFO tractor beam also snags item boxes from a wider radius
          const grabR = k.perkTractor ? 26 : 3.2;
          if (dx * dx + dz * dz < grabR && k.y < 2) {
            const respawn = (this.mode === "chaos" ? 2.2 : 4.2) * (k.perkExpress ? 0.65 : 1);
            p.respawnT = respawn;
            p.mesh.visible = false;
            if (k.isPlayer) {
              this.rouletteT = 1.1;
              this.rouletteItem = null;
              useHud.getState().set({ itemRolling: true });
              AudioMan.pickup();
            } else {
              k.item = rollItem(this.positionOf(k), this.karts.filter((x) => !x.eliminated).length);
            }
            this.particles.burst(p.pos, "#64ffda", 8, 3, 4);
            break;
          }
        }
      }
    }
    // coins
    for (const c of this.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 4;
      for (const k of this.karts) {
        if (k.remote || k.eliminated) continue;
        const dx = k.pos.x - c.pos.x, dz = k.pos.z - c.pos.z;
        const d2 = dx * dx + dz * dz;
        if (k.magnetT > 0 && d2 < 200) {
          const d = Math.sqrt(d2) || 1;
          c.pos.x -= (dx / d) * 26 * dt;
          c.pos.z -= (dz / d) * 26 * dt;
          c.mesh.position.copy(c.pos);
        }
        // UFO tractor beam pulls coins in from much further out
        if (k.perkTractor && d2 < 420) {
          const d = Math.sqrt(d2) || 1;
          c.pos.x -= (dx / d) * 20 * dt;
          c.pos.z -= (dz / d) * 20 * dt;
          c.mesh.position.copy(c.pos);
        }
        if (d2 < 2.6) {
          c.taken = true;
          c.mesh.visible = false;
          k.coins++;
          // Coffee Cruiser: every coin is a shot of espresso
          if (k.perkCaffeine) k.boostT = Math.max(k.boostT, 0.35);
          if (k.isPlayer) AudioMan.coinChime();
          this.particles.burst(c.pos, "#ffd700", 6, 3, 4);
          break;
        }
      }
    }
    // obstacle collisions
    for (const ob of this.track.obstacles) {
      for (const k of this.karts) {
        if (k.remote || k.eliminated || k.y > 2.6 || k.bumpCd > 0) continue;
        let hx = 0, hz = 0, hr = ob.radius;
        if (ob.type === "spinner") {
          const arm = this.def.width * 0.575;
          const a = ob.angle;
          const bx = ob.basePos.x + Math.cos(a) * arm, bz = ob.basePos.z + Math.sin(a) * arm;
          const cx = ob.basePos.x - Math.cos(a) * arm, cz = ob.basePos.z - Math.sin(a) * arm;
          const d1 = (k.pos.x - bx) ** 2 + (k.pos.z - bz) ** 2;
          const d2 = (k.pos.x - cx) ** 2 + (k.pos.z - cz) ** 2;
          if (d1 < d2) { hx = bx; hz = bz; hr = 1.5; } else { hx = cx; hz = cz; hr = 1.5; }
        } else if (ob.mesh) {
          hx = ob.mesh.position.x; hz = ob.mesh.position.z;
        } else continue;
        const dx = k.pos.x - hx, dz = k.pos.z - hz;
        const rr = hr + k.radius * k.scale * 0.8;
        if (dx * dx + dz * dz < rr * rr) {
          k.bumpCd = 0.6;
          if (k.giantT > 0) continue; // giants shrug off obstacles
          k.wobbleT = 0.9;
          k.speed *= 0.45;
          k.latVel += clamp(dx * 3, -12, 12);
          if (k.isPlayer) { AudioMan.crash(); this.camShake = Math.max(this.camShake, 0.6); }
          this.particles.burst(this.v1.set(hx, 1.5, hz), "#ffffff", 12, 5, 5);
        }
      }
    }
  }

  modeLogic(dt: number) {
    if (this.mode === "elimination") {
      // leader lap triggers elimination
      const active = this.karts.filter((k) => !k.eliminated && !k.finished);
      let leader: Kart | null = null;
      for (const k of active) if (!leader || k.progressAbs > leader.progressAbs) leader = k;
      if (leader && leader.lap > this.elimLap && leader.lap >= 2 && active.length > 2) {
        this.eliminateLast();
      }
      // player elimination ends their race
      if (this.player.eliminated && this.elimDeadline < 0) {
        AudioMan.wahWah();
        useHud.getState().pushFeed("ELIMINATED! The crowd goes mild.", "#ff4d6d");
        this.elimDeadline = this.raceMs + 2600;
      }
      if (this.elimDeadline > 0 && this.raceMs > this.elimDeadline || (this.player.eliminated && this.resultsAtMs < 0)) {
        if (this.elimDeadline > 0 && this.raceMs > this.elimDeadline) this.concludeRace();
      }
      // player is the last one standing
      if (!this.player.eliminated && this.karts.filter((k) => !k.eliminated && !k.isPlayer).length === 0 && this.resultsAtMs < 0) {
        useHud.getState().pushFeed("LAST RACER STANDING!", "#ffd23f");
        this.concludeRace();
      }
    }
    // finish timeout after player finishes
    if (this.player.finished && this.finTimeout > 0 && this.raceMs > this.finTimeout && this.resultsAtMs < 0) {
      this.concludeRace();
    }
    if (this.player.finished && this.resultsAtMs < 0 && !this.net) {
      // all bots finished too?
      if (this.karts.every((k) => k.isPlayer || k.finished || k.eliminated)) this.concludeRace();
    }
    // auto-drive finished karts gently
    for (const k of this.karts) {
      if (!k.finished || k.remote) continue;
      const samples = this.track.samples;
      const tp = samples[(k.lastIdx + 8) % samples.length].pos;
      const desired = Math.atan2(tp.x - k.pos.x, tp.z - k.pos.z);
      k.yaw += angDiff(desired, k.yaw) * clamp(dt * 2, 0, 1);
      k.speed = k.speed + clamp(8 - k.speed, -8 * dt, 6 * dt);
      if (this.mode !== "elimination" || !k.eliminated) {
        k.pos.addScaledVector(k.forward(this.v1), k.speed * dt);
        k.lastIdx = this.nearestSampleIdx(k.pos);
        k.applyVisual(dt, this.time);
      }
    }
    // team live scores every 3s
    if (this.mode === "team") {
      this.teamTickT -= dt;
      if (this.teamTickT <= 0) {
        this.teamTickT = 3;
        const [a, b] = this.teamScores();
        useHud.getState().pushFeed(`Team scores — You: ${a} · Rivals: ${b}`, a >= b ? "#64ffda" : "#ff4d6d");
      }
    }
    void dt;
  }
  teamTickT = 3;

  teamScores(): [number, number] {
    const order = this.standings();
    let a = 0, b = 0;
    order.forEach((k, i) => {
      const pts = GP_POINTS[i] ?? 0;
      if (k.team === 0) a += pts; else b += pts;
    });
    return [a, b];
  }

  eliminateLast() {
    const active = this.karts.filter((k) => !k.eliminated && !k.finished);
    let last: Kart | null = null;
    for (const k of active) if (!last || k.progressAbs < last.progressAbs) last = k;
    if (!last) return;
    const leader = active.reduce((m, k) => (k.progressAbs > (m?.progressAbs ?? -Infinity) ? k : m), null as Kart | null);
    this.elimLap = leader?.lap ?? this.elimLap + 1;
    last.eliminated = true;
    last.speed = 0;
    this.particles.burst(this.v1.copy(last.pos).setY(2), "#ff4d6d", 26, 7, 8);
    AudioMan.splat();
    useHud.getState().pushFeed(last.isPlayer ? "You've been ELIMINATED!" : `${last.name} got yeeted!`, "#ff4d6d");
    last.built.group.visible = false;
  }

  chaosLogic(dt: number) {
    this.chaosT -= dt;
    if (this.chaosModT > 0) {
      this.chaosModT -= dt;
      if (this.chaosModT <= 0) { this.chaosScale = 1; this.chaosGrav = 1; }
    }
    if (this.chaosT > 0) return;
    this.chaosT = 15;
    const events = [
      { msg: "BOUNCE FEST! Everyone jumps!", fn: () => this.karts.forEach((k) => { if (!k.eliminated && !k.remote && k.grounded) { k.grounded = false; k.vy = 8.5; k.y = 0.1; } }) },
      { msg: "TINY MODE! Everyone shrinks!", fn: () => { this.chaosScale = 0.68; this.chaosModT = 6; this.karts.forEach((k) => { k.scale = 0.68; }); } },
      { msg: "MOON GRAVITY! Floaty jumps!", fn: () => { this.chaosGrav = 0.45; this.chaosModT = 7; } },
      { msg: "BOOST BONANZA! Free boosts!", fn: () => this.karts.forEach((k) => { if (!k.remote && !k.eliminated) k.boostT = Math.max(k.boostT, 1.6); }) },
      { msg: "WOBBLE WAVE! Everyone trips!", fn: () => this.karts.forEach((k) => { if (!k.remote && !k.eliminated && !k.isPlayer) { k.wobbleT = 1.2; k.latVel += rand(-8, 8); } }) },
    ];
    const ev = events[Math.floor(Math.random() * events.length)];
    ev.fn();
    if (this.chaosScale !== 1) this.karts.forEach((k) => { if (!k.eliminated) k.scale = this.chaosScale; });
    AudioMan.boing();
    useHud.getState().set({ chaosEvent: ev.msg });
    useHud.getState().pushFeed(ev.msg, "#c792ff");
    setTimeout(() => { if (this.running) useHud.getState().set({ chaosEvent: null }); }, 3000);
  }

  animateWorld(dt: number) {
    for (const ob of this.track.obstacles) {
      if (ob.type === "spinner") {
        ob.angle += dt * ob.speed;
        if (ob.mesh) ob.mesh.rotation.y = ob.angle;
      } else if (ob.type === "mover" && ob.mesh) {
        const off = Math.sin(this.time * ob.speed * 1.7 + ob.phase) * (ob.width / 2 - 1.2);
        ob.mesh.position.copy(ob.basePos).addScaledVector(ob.lat, off);
        ob.mesh.position.y = 1.4 + Math.abs(Math.sin(this.time * 2.2 + ob.phase)) * 0.35;
        ob.mesh.rotation.y = Math.sin(this.time * ob.speed + ob.phase) * 0.25;
      } else if (ob.type === "bouncer" && ob.mesh) {
        const b = Math.abs(Math.sin(this.time * ob.speed * 2.2 + ob.phase));
        ob.mesh.position.copy(ob.basePos);
        ob.mesh.position.y = 1.7 + b * 5.4;
        const squash = clamp(1 - (1 - b) * 0.4, 0.55, 1);
        ob.mesh.scale.set(2 - squash, squash, 2 - squash);
        ob.mesh.rotation.x += dt * 2;
      }
    }
    // pickups bob handled in interactions; start banner bob
    for (const k of this.karts) {
      if ((k.isPlayer || !k.remote) && !k.finished && !k.eliminated) continue;
      if (k.remote) k.applyVisual(dt, this.time);
    }
    // chaos scale restore
    if (this.chaosModT <= 0 && this.chaosScale !== 1) this.chaosScale = 1;
  }

  // ==========================================================================
  // ITEMS
  // ==========================================================================
  roulette(dt: number) {
    if (this.rouletteT <= 0) return;
    this.rouletteT -= dt;
    AudioMan.rouletteTick();
    const ids: PowerId[] = ["boost", "banana", "punch", "magnet", "shield", "freeze", "giant", "chicken", "reverse", "teleport"];
    useHud.getState().set({ item: ids[Math.floor(Math.random() * ids.length)], itemRolling: this.rouletteT > 0 });
    if (this.rouletteT <= 0) {
      const item = rollItem(this.positionOf(this.player), this.karts.filter((k) => !k.eliminated).length);
      this.player.item = item;
      useHud.getState().set({ item, itemRolling: false });
      AudioMan.itemGot();
    }
  }

  playerUseItem() {
    const p = this.player;
    if (this.phase !== "racing" || this.paused || !p.item || p.itemCd > 0 || p.finished || p.eliminated) return;
    const item = p.item;
    p.item = null;
    p.itemCd = 0.6;
    p.powerupsUsed++;
    useHud.getState().set({ item: null });
    this.executeItem(p, item);
    if (this.net) this.net.room.send({ t: "used", item });
  }

  executeItem(k: Kart, item: PowerId) {
    const hud = useHud.getState();
    const me = k.isPlayer;
    switch (item) {
      case "boost": {
        k.boostT = (k.perkBurner ? 3.1 : 2.2);
        if (me) { AudioMan.startBoost(); setTimeout(() => AudioMan.stopBoost(), 2100); hud.pushFeed("Rocket boost!", "#ff6b35"); }
        break;
      }
      case "banana": {
        this.dropHazard(k, "banana");
        if (me) AudioMan.splat();
        break;
      }
      case "punch": {
        k.punchT = 0.5;
        if (me) AudioMan.punchSwing();
        break;
      }
      case "magnet": {
        k.magnetT = 8;
        if (me) { AudioMan.magnetHum(); hud.pushFeed("Coin magnet engaged!", "#ffe066"); }
        break;
      }
      case "shield": {
        k.shieldT = k.perkTorpedo ? 14 : 7; // Submarine: double-length shields
        if (me) AudioMan.shieldOn();
        break;
      }
      case "freeze": {
        const ahead = this.karts.filter((o) => o !== k && !o.eliminated && !o.finished && o.progressAbs > k.progressAbs);
        for (const o of ahead) {
          if (o.remote) {
            this.net?.room.send({ t: "frozen", target: o.id.replace("peer-", ""), by: k.name });
          } else {
            o.frozenT = Math.max(o.frozenT, o.perkArmor ? 0.8 : 2.2);
            o.latVel += rand(-4, 4);
          }
        }
        if (me || ahead.some((a) => a.isPlayer)) {
          AudioMan.freezeZap();
          this.camShake = Math.max(this.camShake, 0.3);
        }
        hud.pushFeed(`${k.name} dropped a Freeze Bomb!`, "#9bf0ff");
        break;
      }
      case "giant": {
        k.giantT = 6;
        if (me) { AudioMan.giantGrow(); hud.pushFeed("GIANT MODE! Squash time!", "#b6f34d"); }
        else hud.pushFeed(`${k.name} went GIANT!`, "#b6f34d");
        break;
      }
      case "chicken": {
        const target = this.targetAhead(k);
        this.spawnChicken(k, target);
        AudioMan.cluck();
        hud.pushFeed(k.isPlayer ? `Turbo Chicken launched at ${target?.name ?? "nobody"}!` : `${k.name} launched a poultry missile!`, "#f6e7c1");
        break;
      }
      case "reverse": {
        const t = this.targetAhead(k);
        if (t) {
          if (t.remote) this.net?.room.send({ t: "reversed", target: t.id.replace("peer-", ""), by: k.name });
          else t.reversedT = Math.max(t.reversedT, 4);
          if (me) { AudioMan.reverseZap(); hud.pushFeed(`Reversed ${t.name}'s controls!`, "#c792ff"); }
          if (t.isPlayer) hud.pushFeed("YOUR CONTROLS ARE REVERSED!", "#ff4d6d");
        }
        break;
      }
      case "teleport": {
        const N = this.track.samples.length;
        const maxJump = (k.lcount + 1) * N - 40;
        const newAbs = Math.min(k.progressAbs + N * 0.05, Math.max(maxJump, N * 0.3));
        const idx = Math.floor(newAbs) % N;
        const s = this.track.samples[idx];
        this.particles.burst(k.pos, "#64ffda", 16, 5, 6);
        k.pos.copy(s.pos).addScaledVector(s.lat, rand(-2, 2));
        k.yaw = s.yaw;
        k.lastIdx = idx;
        k.progressAbs = newAbs;
        this.particles.burst(k.pos, "#64ffda", 16, 5, 6);
        if (me) { AudioMan.teleport(); hud.pushFeed("Teleported! Surprise!", "#64ffda"); }
        break;
      }
    }
  }

  targetAhead(k: Kart): Kart | null {
    let best: Kart | null = null;
    let bestD = Infinity;
    for (const o of this.karts) {
      if (o === k || o.eliminated || o.finished) continue;
      const gap = o.progressAbs - k.progressAbs;
      if (gap > 0 && gap < bestD) { bestD = gap; best = o; }
    }
    if (!best) {
      for (const o of this.karts) {
        if (o === k || o.eliminated || o.finished) continue;
        if (!best || o.progressAbs > best.progressAbs) best = o;
      }
    }
    return best;
  }

  dropHazard(k: Kart, kind: "banana" | "egg") {
    const pos = k.pos.clone().addScaledVector(k.forward(this.v1), -2.4);
    pos.y = 0;
    const mesh = kind === "banana" ? buildBananaMesh() : buildEggMesh();
    mesh.position.copy(pos).setY(kind === "banana" ? 0.15 : 0.1);
    mesh.rotation.y = Math.random() * TAU;
    this.scene.add(mesh);
    this.hazards.push({ kind, mesh, pos, owner: k.id, age: 0 });
    if (this.net && k.isPlayer) this.net.room.send({ t: "hazard", kind, pos: [pos.x, pos.z], owner: k.id });
  }

  spawnChicken(k: Kart, target: Kart | null) {
    const mesh = buildChickenMesh();
    mesh.position.copy(k.pos).setY(1.4);
    this.scene.add(mesh);
    const ch: Chicken = {
      mesh, pos: k.pos.clone().setY(1.6),
      targetId: target?.id ?? "", owner: k.id, ownerName: k.name, age: 0,
    };
    this.chickens.push(ch);
    // any remote target (human on another client) gets the cluck directly
    if (this.net && target?.remote) {
      this.net.room.send({ t: "chicken", target: target.id.replace("peer-", ""), by: k.name });
    }
  }

  punchCheck(k: Kart) {
    const fwd = k.forward(this.v1);
    const gx = k.pos.x + fwd.x * 4.4, gz = k.pos.z + fwd.z * 4.4;
    for (const o of this.karts) {
      if (o === k || o.eliminated || o.punchImmune > this.time) continue;
      const dx = o.pos.x - gx, dz = o.pos.z - gz;
      if (dx * dx + dz * dz < 6.8) {
        o.punchImmune = this.time + 1;
        if (o.remote) {
          this.net?.room.send({ t: "punched", target: o.id.replace("peer-", ""), by: k.name });
        } else {
          const soft = o.perkArmor;
          o.latVel += clamp(dx * 4, -16, 16) * (soft ? 0.3 : 1);
          if (!soft) o.spinOut(1.1, this); else o.wobbleT = 0.8;
          o.speed *= soft ? 0.85 : 0.5;
        }
        AudioMan.punchHit();
        if (k.isPlayer) useHud.getState().pushFeed(`MEGA PUNCHED ${o.name}!`, "#ff4d6d");
        if (o.isPlayer) { useHud.getState().pushFeed(`Punched by ${k.name}!`, "#ff4d6d"); this.camShake = 0.6; }
        this.particles.burst(this.v2.set(o.pos.x, 1.5, o.pos.z), "#ff4d6d", 14, 5, 6);
      }
    }
  }

  updateHazards(dt: number) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.age += dt;
      h.mesh.rotation.y += dt * 1.2;
      if (h.age > 30) {
        this.scene.remove(h.mesh);
        this.hazards.splice(i, 1);
        continue;
      }
      for (const k of this.karts) {
        if (k.remote || k.eliminated || k.id === h.owner || k.y > 1.6 || h.age < 0.8) continue;
        const dx = k.pos.x - h.pos.x, dz = k.pos.z - h.pos.z;
        if (dx * dx + dz * dz < 1.7) {
          // monster truck crushes bananas
          if (k.perkCrush && h.kind === "banana") {
            this.particles.burst(h.pos, "#ffd23f", 6, 3, 3);
            if (k.isPlayer) useHud.getState().pushFeed("Crushed a banana!", "#ffd23f");
          } else if (k.shieldT > 0) {
            k.shieldT = 0;
            if (k.isPlayer) { AudioMan.shieldPop(); useHud.getState().pushFeed("Shield popped!", "#66e0ff"); }
          } else if (k.giantT > 0) {
            this.particles.burst(h.pos, "#ffd23f", 6, 3, 3);
          } else {
            k.spinOut(k.perkArmor ? 0.55 : 1.25, this);
            k.speed *= 0.3;
            if (k.isPlayer) {
              AudioMan.slip();
              this.camShake = Math.max(this.camShake, 0.55);
              this.particles.burst(k.pos, h.kind === "banana" ? "#ffd23f" : "#fbf3df", 12, 4, 5);
            }
          }
          this.scene.remove(h.mesh);
          this.hazards.splice(i, 1);
          break;
        }
      }
    }
  }

  updateChickens(dt: number) {
    for (let i = this.chickens.length - 1; i >= 0; i--) {
      const c = this.chickens[i];
      c.age += dt;
      const target = this.karts.find((k) => k.id === c.targetId && !k.eliminated && !k.finished);
      if (target) {
        const dx = target.pos.x - c.pos.x, dz = target.pos.z - c.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        const sp = 27 + c.age * 3;
        c.pos.x += (dx / d) * sp * dt;
        c.pos.z += (dz / d) * sp * dt;
        c.mesh.rotation.y = Math.atan2(dx, dz);
        // flap
        const w = c.mesh.userData as { wingL?: THREE.Object3D; wingR?: THREE.Object3D };
        if (w.wingL) w.wingL.rotation.z = Math.sin(this.time * 26) * 1.1;
        if (w.wingR) w.wingR.rotation.z = -Math.sin(this.time * 26) * 1.1;
        if (!target.remote && d < 2.4) {
          // hit!
          if (target.shieldT > 0) {
            target.shieldT = 0;
            if (target.isPlayer) AudioMan.shieldPop();
          } else if (target.giantT <= 0) {
            target.spinOut(target.perkArmor ? 0.6 : 1.3, this);
            target.speed *= 0.35;
          }
          AudioMan.cluck();
          AudioMan.crash();
          if (target.isPlayer) { this.camShake = 0.7; useHud.getState().pushFeed(`CLUCKED by ${c.ownerName}!`, "#ff4d6d"); }
          if (c.owner === this.player.id) useHud.getState().pushFeed(`Your chicken nailed ${target.name}!`, "#f6e7c1");
          this.featherBurst(c.pos);
          this.scene.remove(c.mesh);
          this.chickens.splice(i, 1);
          continue;
        }
      }
      c.mesh.position.copy(c.pos);
      if (c.age > 8) {
        this.featherBurst(c.pos);
        this.scene.remove(c.mesh);
        this.chickens.splice(i, 1);
      }
    }
  }

  featherBurst(p: THREE.Vector3) {
    this.particles.burst(p, "#fbf3df", 16, 5, 6);
    this.particles.burst(p, "#e63946", 6, 4, 5);
  }

  // ==========================================================================
  // NET
  // ==========================================================================
  wireNet() {
    if (!this.net) return;
    const room = this.net.room;
    this.disposers.push(room.onMessage((from, m) => this.onNetMsg(from, m)));
    this.disposers.push(room.onPeerLeft((id) => {
      const k = this.remotesById.get(`peer-${id}`);
      if (k) {
        k.eliminated = true;
        k.built.group.visible = false;
      }
      useHud.getState().pushFeed("A racer disconnected", "#ff7f2a");
      const rec = this.results.find((r) => r.id === `peer-${id}`);
      if (rec && rec.ms === null) rec.ms = 999999;
    }));
  }

  onNetMsg(from: string, m: NetMsg) {
    const hud = useHud.getState();
    const k = this.remotesById.get(`peer-${from}`);
    switch (m.t) {
      case "st": {
        if (k) {
          const p = m as unknown as { pos: [number, number, number]; yaw: number; spd: number; prog: number; lap: number; scl: number; flags: Record<string, boolean> };
          if (!k.netTargetPos) k.netTargetPos = k.pos.clone();
          k.netTargetPos.set(p.pos[0], p.pos[1], p.pos[2]);
          k.netTargetYaw = p.yaw;
          k.netSpeed = p.spd;
          k.progressAbs = p.prog;
          k.lap = p.lap;
          k.netScale = p.scl;
          const f = p.flags ?? {};
          k.boostT = f.bo ? Math.max(k.boostT, 0.2) : 0;
          k.drifting = !!f.dr;
          k.spinT = f.sp ? 0.4 : 0;
          k.giantT = f.gi ? Math.max(k.giantT, 0.4) : 0;
          k.frozenT = f.fr ? Math.max(k.frozenT, 0.4) : 0;
          k.shieldT = f.sh ? Math.max(k.shieldT, 0.4) : 0;
          if (f.fin && !k.finished) {
            k.finished = true;
            k.finishedDance = ["spin", "robot", "worm", "floss"][Math.floor(Math.random() * 4)];
          }
        }
        break;
      }
      case "bots": {
        // host simulates bots; guests adopt states
        if (!this.net?.selfIsGuest) break;
        const arr = (m as unknown as { bots: { id: string; pos: [number, number, number]; yaw: number; spd: number; prog: number; lap: number; elim: boolean; fin: boolean }[] }).bots;
        for (const b of arr) {
          const bk = this.karts.find((x) => x.id === b.id);
          if (!bk) continue;
          if (!bk.netTargetPos) bk.netTargetPos = bk.pos.clone();
          bk.netTargetPos.set(b.pos[0], b.pos[1], b.pos[2]);
          bk.netTargetYaw = b.yaw;
          bk.netSpeed = b.spd;
          bk.progressAbs = b.prog;
          bk.lap = b.lap;
          bk.remote = true;
          if (b.elim && !bk.eliminated) { bk.eliminated = true; bk.built.group.visible = false; }
          if (b.fin && !bk.finished) { bk.finished = true; bk.finishedDance = "spin"; }
        }
        break;
      }
      case "hazard": {
        const pos = new THREE.Vector3((m.pos as number[])[0], 0, (m.pos as number[])[1]);
        const mesh = m.kind === "banana" ? buildBananaMesh() : buildEggMesh();
        mesh.position.copy(pos).setY(0.15);
        this.scene.add(mesh);
        this.hazards.push({ kind: m.kind as "banana" | "egg", mesh, pos, owner: `peer-${from}`, age: 1 });
        break;
      }
      case "punched": {
        if (this.net && (m as NetMsg).target !== this.net.selfPeerId) break;
        hud.pushFeed(`Punched by ${String((m as NetMsg).by ?? "?")}!`, "#ff4d6d");
        this.player.spinOut(this.player.perkArmor ? 0.55 : 1.1, this);
        this.player.speed *= 0.5;
        AudioMan.punchHit();
        this.camShake = 0.7;
        break;
      }
      case "frozen": {
        if (this.net && (m as NetMsg).target !== this.net.selfPeerId) break;
        this.player.frozenT = Math.max(this.player.frozenT, this.player.perkArmor ? 0.8 : 2.2);
        AudioMan.freezeZap();
        hud.pushFeed(`Frozen by ${String((m as NetMsg).by ?? "?")}!`, "#9bf0ff");
        break;
      }
      case "reversed": {
        if (this.net && (m as NetMsg).target !== this.net.selfPeerId) break;
        this.player.reversedT = Math.max(this.player.reversedT, 4);
        AudioMan.reverseZap();
        hud.pushFeed(`${String((m as NetMsg).by ?? "?")} scrambled your controls!`, "#c792ff");
        break;
      }
      case "chicken": {
        if (this.net && (m as NetMsg).target !== this.net.selfPeerId) break;
        hud.pushFeed(`Incoming chicken from ${String((m as NetMsg).by ?? "?")}!`, "#f6e7c1");
        AudioMan.cluck();
        this.player.spinOut(this.player.perkArmor ? 0.6 : 1.3, this);
        this.player.speed *= 0.35;
        this.camShake = 0.65;
        this.featherBurst(this.player.pos);
        break;
      }
      case "fin": {
        const rec = this.results.find((r) => r.id === `peer-${from}`);
        if (rec && rec.ms === null) rec.ms = Number((m as NetMsg).ms ?? 999999);
        if (k) k.finished = true;
        hud.pushFeed(`${String((m as NetMsg).name ?? "A racer")} finished!`, "#ffffff");
        if (this.net && !this.net.selfIsGuest) this.hostCheckResults();
        break;
      }
      case "results": {
        if (this.gotResults) break;
        this.gotResults = true;
        const rows = (m as unknown as { rows: { name: string; ms: number | null; isBot: boolean; id: string }[] }).rows;
        rows.forEach((r) => {
          const rec = this.results.find((x) => x.name === r.name);
          if (rec && r.ms !== null && rec.ms === null) rec.ms = r.ms;
        });
        if (this.resultsAtMs < 0) this.concludeRace();
        break;
      }
    }
  }

  hostCheckResults() {
    if (!this.net || this.net.selfIsGuest) return;
    const humans = this.results.filter((r) => !r.isBot);
    if (humans.every((r) => r.ms !== null)) {
      const rows = this.results.map((r) => ({ name: r.name, ms: r.ms, isBot: r.isBot, id: r.id }));
      this.net.room.send({ t: "results", rows });
      if (this.resultsAtMs < 0 && this.player.finished) this.concludeRace();
    }
  }

  netUpdate(dt: number) {
    this.netTick -= dt;
    if (this.netTick > 0 || !this.net) return;
    this.netTick = 0.066;
    const p = this.player;
    const flags = { bo: p.boostT > 0, dr: p.drifting, sp: p.spinT > 0, gi: p.giantT > 0, fr: p.frozenT > 0, sh: p.shieldT > 0, fin: p.finished };
    this.net.room.send({ t: "st", pos: [p.pos.x, p.y, p.pos.z], yaw: p.yaw, spd: p.speed, prog: p.progressAbs, lap: p.lap, scl: p.giantT > 0 ? 1.55 : 1, flags });
    if (!this.net.selfIsGuest) {
      const bots = this.karts.filter((k) => k.isBot).map((k) => ({ id: k.id, pos: [+k.pos.x.toFixed(1), +k.y.toFixed(1), +k.pos.z.toFixed(1)], yaw: +k.yaw.toFixed(2), spd: +k.speed.toFixed(1), prog: Math.round(k.progressAbs), lap: k.lap, elim: k.eliminated, fin: k.finished }));
      if (bots.length) this.net.room.send({ t: "bots", bots });
    }
  }

  stepRemote(k: Kart, dt: number) {
    if (!k.netTargetPos) return;
    const f = 1 - Math.exp(-dt * 10);
    k.pos.lerp(k.netTargetPos, f);
    k.y += (k.netTargetPos.y - k.y) * f;
    k.yaw += angDiff(k.netTargetYaw, k.yaw) * f * 1.4;
    k.speed = k.netSpeed;
    k.steerVis = clamp(angDiff(k.netTargetYaw, k.yaw) * 3, -1, 1);
    k.applyVisual(dt, this.time);
  }

  // ==========================================================================
  // POSITIONS, RESULTS
  // ==========================================================================
  standings(): Kart[] {
    const active = this.karts.filter((k) => !k.eliminated);
    return active.sort((a, b) => {
      if (a.finished && b.finished) return a.finishMs - b.finishMs;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progressAbs - a.progressAbs;
    });
  }

  positionOf(k: Kart): number {
    return this.standings().indexOf(k) + 1;
  }

  concludeRace() {
    if (this.resultsAtMs >= 0) return;
    this.resultsAtMs = this.raceMs;
    // finalize recs
    for (const k of this.karts) {
      const rec = this.results.find((r) => r.id === k.id)!;
      if (rec.ms === null && k.finished) rec.ms = k.finishMs;
    }
    const hud = useHud.getState();
    // rank: finished by time, then by progress
    const order = [...this.karts].sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (a.finished && b.finished) return a.finishMs - b.finishMs;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progressAbs - a.progressAbs;
    });
    const standingsRows = order.map((k, i) => ({
      name: k.name, position: i + 1, isPlayer: k.isPlayer, isBot: k.isBot, team: k.team,
      totalMs: k.finished ? k.finishMs : undefined,
    }));
    const pPos = standingsRows.find((r) => r.isPlayer)?.position ?? order.length;
    const teamScores = this.mode === "team" ? this.teamScoresFinal(order) : undefined;
    const summary: RaceSummary = {
      mode: this.mode,
      trackId: this.def.id,
      trackName: this.def.name,
      vehicleId: this.player.veh.id,
      position: this.player.eliminated ? Math.max(pPos, order.filter((r) => !r.eliminated).length + 1) : pPos,
      fieldSize: this.karts.length,
      totalMs: this.player.finishMs || this.raceMs,
      bestLapMs: this.player.bestLapMs,
      coinsCollected: this.player.coins,
      powerupsUsed: this.player.powerupsUsed,
      driftMs: this.player.driftMs,
      standings: standingsRows,
      teamScores,
      eliminated: this.player.eliminated,
      win: pPos === 1 || (teamScores ? teamScores[0] > teamScores[1] : false),
    };
    hud.pushFeed("Race over!", "#ffd23f");
    AudioMan.stopDrift();
    AudioMan.stopBoost();
    AudioMan.startMusic("podium");
    setTimeout(() => {
      if (!this.running) return;
      this.phase = "over";
      this.cfg.onFinish(summary);
    }, 1600);
  }

  teamScoresFinal(order: Kart[]): [number, number] {
    let a = 0, b = 0;
    order.forEach((k, i) => {
      const pts = GP_POINTS[i] ?? 0;
      if (k.team === 0) a += pts; else b += pts;
    });
    return [a, b];
  }

  // ==========================================================================
  // AUDIO / CAMERA / HUD
  // ==========================================================================
  audioUpdate() {
    const p = this.player;
    const rpm = clamp(Math.abs(p.speed) / p.maxSpeed, 0, 1.2);
    const b = this.cfg.controls.keys;
    AudioMan.setEngine(rpm, this.keys["ArrowUp"] || this.keys[b.accel] || this.touch.throttle > 0 ? 1 : 0.35);
    if (p.boostT > 0 && !AudioMan.boostSrc) AudioMan.startBoost();
    if (p.boostT <= 0 && AudioMan.boostSrc) AudioMan.stopBoost();
    if (p.drifting && !AudioMan.driftSrc) AudioMan.startDrift();
    if (!p.drifting && AudioMan.driftSrc) AudioMan.stopDrift();
  }

  renderCam(dt: number, slow: boolean) {
    const p = this.player;
    const fwd = p.forward(this.v1);
    const back = 9 + Math.abs(p.speed) * 0.16;
    const up = 4.4 + Math.abs(p.speed) * 0.035 + p.y * 0.4;
    const target = this.v2.copy(p.pos).addScaledVector(fwd, -back);
    target.y = this.v2.y; // keep y
    target.y = p.pos.y + p.y * 0.5 + up;
    // orbit intro during countdown
    if (this.phase === "countdown") {
      const a = (3.4 - this.countdownT) * 0.5;
      target.copy(p.pos).add(this.v3.set(Math.sin(p.yaw + a) * -11, 5.5, Math.cos(p.yaw + a) * -11));
    }
    const f = 1 - Math.exp(-dt * (slow ? 3.5 : 5.5));
    this.camera.position.lerp(target, f);
    const look = this.v3.copy(p.pos).addScaledVector(fwd, 5);
    look.y = p.pos.y + p.y * 0.6 + 1.4;
    if (this.cfg.settings.shake && this.camShake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.camShake;
      this.camera.position.y += (Math.random() - 0.5) * this.camShake * 0.7;
      this.camShake = Math.max(0, this.camShake - dt * 1.8);
      look.x += (Math.random() - 0.5) * this.camShake * 0.6;
    }
    this.camera.lookAt(look);
    const targetFov = 62 + clamp(Math.abs(p.speed) - 20, 0, 26) * 0.6 + (p.boostT > 0 ? 8 : 0);
    this.fov += (targetFov - this.fov) * clamp(dt * 3, 0, 1);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  pushHud() {
    const now = performance.now();
    if (now - this.hudTimer < 50) return;
    this.hudTimer = now;
    const hud = useHud.getState();
    const p = this.player;
    if (this.mode === "practice") { /* keep timer only */ }
    const racers = this.standings().map((k) => {
      const N = this.track.samples.length;
      return {
        id: k.id, name: k.name,
        t: ((k.lastIdx % N) + N) % N / N,
        lap: k.lap, isPlayer: k.isPlayer, isBot: k.isBot,
        color: k.color, finished: k.finished, eliminated: k.eliminated,
      };
    });
    hud.set({
      speed: Math.abs(p.speed) * 3.1,
      boostCharge: clamp(p.driftCharge / 1.2, 0, 1),
      boosting: p.boostT > 0,
      lap: Math.min(p.lap, this.laps || p.lap),
      lapTimeMs: this.phase === "racing" ? this.raceMs - p.lapStartMs : 0,
      raceTimeMs: this.raceMs,
      position: this.positionOf(p),
      fieldSize: this.karts.filter((k) => !k.eliminated).length,
      coins: p.coins,
      frozen: p.frozenT > 0,
      reversed: p.reversedT > 0,
      shielded: p.shieldT > 0,
      giant: p.giantT > 0,
      offTrack: this.playerOffTrack && this.phase === "racing",
      wrongWay: p.wrongWayT > 1,
      racers,
    });
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    for (const d of this.disposers) d();
    AudioMan.stopEngine();
    AudioMan.stopDrift();
    AudioMan.stopBoost();
    this.renderer.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
  }
}

