// ============================================================================
// WACKY RACING — static game catalog (single source of truth, shared client+server)
// ============================================================================

export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9aa7b8",
  rare: "#2dd4c8",
  epic: "#8b5cf6",
  legendary: "#ffd23f",
};

export const RARITY_MULT: Record<Rarity, number> = {
  common: 1,
  rare: 1.4,
  epic: 1.8,
  legendary: 2.4,
};

// ---------------------------------------------------------------------------
// Vehicles (20)
// ---------------------------------------------------------------------------

export interface VehicleStats {
  /** 0..100 — top speed */
  speed: number;
  /** 0..100 — acceleration */
  accel: number;
  /** 0..100 — turn rate */
  handling: number;
  /** 0..100 — drift charge rate / grip while drifting */
  drift: number;
  /** 0..100 — mass (collision weight, higher = heavier) */
  weight: number;
}

export type VehicleShape =
  | "kart" | "cart" | "bike" | "scooter" | "skateboard" | "mower"
  | "tub" | "rocket" | "toaster" | "banana" | "cup" | "duck" | "truck"
  | "carpet" | "tank" | "balloon" | "sub" | "dino" | "ufo" | "chariot";

export interface Vehicle {
  id: string;
  name: string;
  rarity: Rarity;
  /** coins; 0 = starter (not purchasable, excluded from crate pools) */
  price: number;
  /** optional gem price (epics / legendaries) */
  gems?: number;
  stats: VehicleStats;
  shape: VehicleShape;
  ability: string;
  abilityDesc: string;
  desc: string;
  paint: string;
}

export const VEHICLES: readonly Vehicle[] = [
  // ---- common ----
  { id: "shopping-cart", name: "Shopping Cart", rarity: "common", price: 0, stats: { speed: 45, accel: 55, handling: 60, drift: 40, weight: 40 }, shape: "cart", ability: "Grocery Rush", abilityDesc: "Starts every race with a small boost", desc: "A supermarket trolley with dreams of glory.", paint: "#c8ccd4" },
  { id: "chicken-bike", name: "Chicken Bike", rarity: "common", price: 0, stats: { speed: 50, accel: 60, handling: 65, drift: 45, weight: 30 }, shape: "bike", ability: "Egg Kick", abilityDesc: "Hitting rivals drops a speed egg", desc: "Bawk-powered two-wheeler.", paint: "#f2f2f2" },
  { id: "pizza-scooter", name: "Pizza Scooter", rarity: "common", price: 800, stats: { speed: 58, accel: 62, handling: 58, drift: 50, weight: 38 }, shape: "scooter", ability: "Hot Slice", abilityDesc: "Boost lasts 25% longer", desc: "30 minutes or your chaos is free.", paint: "#ff7f2a" },
  { id: "skateboard-supreme", name: "Skateboard Supreme", rarity: "common", price: 1200, stats: { speed: 52, accel: 66, handling: 78, drift: 72, weight: 22 }, shape: "skateboard", ability: "Kickflip", abilityDesc: "Ramps give an instant trick boost", desc: " ollies over problems. Literally.", paint: "#8b5cf6" },
  { id: "lawn-mower-menace", name: "Lawn Mower Menace", rarity: "common", price: 1600, stats: { speed: 48, accel: 50, handling: 52, drift: 38, weight: 70 }, shape: "mower", ability: "Grass Clippings", abilityDesc: "Off-track barely slows you down", desc: "Mowing the competition since 1987.", paint: "#3ddc84" },
  // ---- rare ----
  { id: "bathtub-racer", name: "Bathtub Racer", rarity: "rare", price: 2500, stats: { speed: 55, accel: 55, handling: 70, drift: 60, weight: 55 }, shape: "tub", ability: "Bubble Slide", abilityDesc: "Drifting charges faster on wet tracks", desc: "No soap. Only speed.", paint: "#ffffff" },
  { id: "rocket-scooter", name: "Rocket Scooter", rarity: "rare", price: 3200, stats: { speed: 70, accel: 72, handling: 52, drift: 45, weight: 40 }, shape: "rocket", ability: "Afterburner", abilityDesc: "+10% top speed", desc: "Hold on tight.", paint: "#ff4d6d" },
  { id: "toaster-turbo", name: "Toaster Turbo", rarity: "rare", price: 3800, stats: { speed: 56, accel: 78, handling: 58, drift: 50, weight: 45 }, shape: "toaster", ability: "Pop-Up Launch", abilityDesc: "Hops forward from a standstill every 20 s", desc: "Toast-powered.", paint: "#c9ced6" },
  { id: "banana-mobile", name: "Banana Mobile", rarity: "rare", price: 4500, stats: { speed: 60, accel: 60, handling: 66, drift: 66, weight: 42 }, shape: "banana", ability: "Slipstream Peel", abilityDesc: "Bananas you drop are extra slippery", desc: "Goes great with chaos.", paint: "#ffd23f" },
  { id: "coffee-cup-cruiser", name: "Coffee Cup Cruiser", rarity: "rare", price: 5200, stats: { speed: 62, accel: 68, handling: 60, drift: 55, weight: 46 }, shape: "cup", ability: "Caffeine Rush", abilityDesc: "Every coin is a mini-boost", desc: "Now with 200% more zoom.", paint: "#8a5a3b" },
  { id: "rubber-duck-car", name: "Rubber Duck Car", rarity: "rare", price: 6000, stats: { speed: 54, accel: 58, handling: 74, drift: 70, weight: 35 }, shape: "duck", ability: "Bath Time", abilityDesc: "Shields last twice as long", desc: "Squeaks when you drift.", paint: "#ffd23f" },
  { id: "ice-cream-truck", name: "Ice Cream Truck", rarity: "rare", price: 6800, stats: { speed: 58, accel: 56, handling: 62, drift: 52, weight: 60 }, shape: "truck", ability: "Brain Freeze", abilityDesc: "Bumping you chills the attacker", desc: "The jingle means business.", paint: "#ff9de2" },
  { id: "monster-truck", name: "Monster Truck", rarity: "rare", price: 8000, stats: { speed: 62, accel: 60, handling: 48, drift: 40, weight: 95 }, shape: "truck", ability: "Crusher", abilityDesc: "Bumps send rivals flying", desc: "It's bigger than your problems.", paint: "#2dd4c8" },
  // ---- epic ----
  { id: "flying-carpet", name: "Flying Carpet", rarity: "epic", price: 12000, gems: 40, stats: { speed: 72, accel: 66, handling: 70, drift: 62, weight: 40 }, shape: "carpet", ability: "Sky High", abilityDesc: "Falls slower and glides further off ramps", desc: "Mind the tassels at 200 km/h.", paint: "#8b5cf6" },
  { id: "mini-tank", name: "Mini Tank", rarity: "epic", price: 15000, gems: 55, stats: { speed: 60, accel: 52, handling: 50, drift: 35, weight: 100 }, shape: "tank", ability: "Rolling Fortress", abilityDesc: "Hazards can't spin you out", desc: "Tiny tank, huge ego.", paint: "#5b6b4f" },
  { id: "hot-air-kart", name: "Hot Air Kart", rarity: "epic", price: 18000, gems: 70, stats: { speed: 66, accel: 62, handling: 64, drift: 58, weight: 36 }, shape: "balloon", ability: "Updraft", abilityDesc: "Ramps launch you higher", desc: "Fueled by pure hot air.", paint: "#ff5ca8" },
  { id: "submarine-racer", name: "Submarine Racer", rarity: "epic", price: 22000, gems: 90, stats: { speed: 68, accel: 64, handling: 72, drift: 66, weight: 58 }, shape: "sub", ability: "Torpedo Mode", abilityDesc: "Rockets boost harder", desc: "Periscope optional.", paint: "#2f6fb2" },
  // ---- legendary ----
  { id: "dino-stomper", name: "Dino Stomper", rarity: "legendary", price: 40000, gems: 150, stats: { speed: 74, accel: 70, handling: 62, drift: 55, weight: 92 }, shape: "dino", ability: "Prehistoric Stomp", abilityDesc: "Landing from big jumps shockwaves rivals away", desc: "RAWWR means go faster.", paint: "#3ddc84" },
  { id: "ufo-saucer", name: "UFO Saucer", rarity: "legendary", price: 55000, gems: 200, stats: { speed: 78, accel: 74, handling: 78, drift: 70, weight: 48 }, shape: "ufo", ability: "Tractor Beam", abilityDesc: "Magnetises coins and item boxes", desc: "They came in peace. And first place.", paint: "#9bf0ff" },
  { id: "golden-chariot", name: "Golden Chariot", rarity: "legendary", price: 80000, gems: 300, stats: { speed: 85, accel: 82, handling: 80, drift: 78, weight: 60 }, shape: "chariot", ability: "Champion's Aura", abilityDesc: "+15% coins from every race", desc: "Solid gold. Zero regrets.", paint: "#ffd23f" },
] as const;

export function vehicleById(id: string): Vehicle {
  return VEHICLES.find((v) => v.id === id) ?? VEHICLES[0];
}

// ---------------------------------------------------------------------------
// Characters / cosmetics
// ---------------------------------------------------------------------------

export interface Cosmetic { id: string; name: string; price: number; desc?: string; }

export const CHARACTERS: readonly Cosmetic[] = [
  { id: "cappy", name: "Cappy", price: 0, desc: "A racer with a cap. Iconic." },
  { id: "bean", name: "Bean", price: 600, desc: "Long and lean." },
  { id: "mocha", name: "Mocha", price: 900, desc: "Runs on coffee." },
  { id: "pickles", name: "Pickles", price: 1200, desc: "Crunchy under pressure." },
  { id: "nova", name: "Nova", price: 1800, desc: "Literally out of this world." },
  { id: "ziggy", name: "Ziggy", price: 2600, desc: "Zigzags through traffic." },
] as const;

export const HATS: readonly Cosmetic[] = [
  { id: "none", name: "Bare Head", price: 0 },
  { id: "crown", name: "Crown", price: 500, desc: "For champions only." },
  { id: "duck-hat", name: "Duck Hat", price: 350, desc: "Quack." },
  { id: "viking", name: "Viking Helm", price: 450, desc: "Horns included." },
  { id: "party", name: "Party Cone", price: 200 },
  { id: "propeller", name: "Propeller Cap", price: 700 },
  { id: "chef", name: "Chef Toque", price: 900, desc: "Kiss the apex." },
] as const;

export const WHEELS: readonly Cosmetic[] = [
  { id: "classic", name: "Classic", price: 0 },
  { id: "slick", name: "Slick", price: 400, desc: "Low grip, high style." },
  { id: "offroad", name: "Off-Road", price: 600 },
  { id: "chrome", name: "Chrome", price: 900, desc: "Shiny!" },
  { id: "rainbow", name: "Rainbow", price: 1500 },
] as const;

export const HORNS: readonly Cosmetic[] = [
  { id: "honk", name: "Classic Honk", price: 0 },
  { id: "squeak", name: "Squeaky Toy", price: 250 },
  { id: "airhorn", name: "Airhorn", price: 500 },
  { id: "duck", name: "Duck Horn", price: 750 },
  { id: "trumpet", name: "Trumpet", price: 1200 },
  { id: "kazoo", name: "Kazoo", price: 2000, desc: "The sound of victory." },
] as const;

export const DANCES: readonly Cosmetic[] = [
  { id: "wiggle", name: "The Wiggle", price: 0 },
  { id: "spin", name: "360 Spin", price: 500 },
  { id: "floss", name: "Floss", price: 800 },
  { id: "moonwalk", name: "Moonwalk", price: 1400 },
  { id: "robot", name: "Robot", price: 2200 },
] as const;

export function cosmeticById(arr: readonly Cosmetic[], id: string): Cosmetic {
  return arr.find((c) => c.id === id) ?? arr[0];
}

// ---------------------------------------------------------------------------
// Tracks (8)
// ---------------------------------------------------------------------------

export interface TrackTheme {
  sky: number;
  fog: number;
  ground: number;
  road: number;
  curbA: string;
  curbB: string;
  accent: number;
  decor: "candy" | "toilet" | "jungle" | "toy" | "sky" | "volcano" | "ice" | "alien";
}

export interface TrackDef {
  id: string;
  name: string;
  desc: string;
  /** control points (x, z) of a closed loop */
  points: [number, number][];
  /** road half-width in meters (full width = 2 * width) — engine uses width as half-width */
  width: number;
  /** default laps for quick race */
  laps: number;
  /** grip multiplier (ice road is slippery) */
  grip: number;
  theme: TrackTheme;
  /** rolling hills: {at: 0..1 around track, w: width fraction, h: height} */
  hills?: { at: number; w: number; h: number }[];
  /** jump ramps: smooth bumps that launch karts */
  ramps?: { at: number; len: number; h: number }[];
  /** moving obstacles */
  moving?: boolean;
}

export const TRACKS: readonly TrackDef[] = [
  {
    id: "candy-rush", name: "Candy Rush", desc: "A sugar-coated speedway of lollipops and gumdrops.",
    points: [[0, -95], [65, -78], [100, -20], [78, 50], [20, 88], [-55, 78], [-100, 25], [-85, -50]],
    width: 7, laps: 3, grip: 1,
    theme: { sky: 0xffd9ec, fog: 0xffc7e3, ground: 0xffb3d9, road: 0x7a4bd6, curbA: "#ff5ca8", curbB: "#fff8ef", accent: 0xffd23f, decor: "candy" },
    hills: [{ at: 0.35, w: 0.03, h: 4 }],
    ramps: [{ at: 0.62, len: 0.035, h: 5 }],
    moving: false,
  },
  {
    id: "toilet-town", name: "Toilet Town", desc: "Plunge into porcelain canyons and rubber-duck dams.",
    points: [[0, -80], [55, -85], [95, -45], [85, 10], [110, 60], [60, 95], [0, 70], [-50, 90], [-95, 45], [-70, -10], [-95, -50]],
    width: 6.5, laps: 3, grip: 0.92,
    theme: { sky: 0xbfe8ff, fog: 0xa8d8f0, ground: 0xdff3ff, road: 0x5b8dd9, curbA: "#2dd4c8", curbB: "#ffffff", accent: 0xffd23f, decor: "toilet" },
    hills: [{ at: 0.15, w: 0.025, h: 3 }, { at: 0.7, w: 0.03, h: 5 }],
    ramps: [{ at: 0.45, len: 0.03, h: 4.5 }],
    moving: true,
  },
  {
    id: "banana-jungle", name: "Banana Jungle", desc: "Slippery peels everywhere. Watch your tail.",
    points: [[0, -100], [70, -70], [60, 0], [100, 55], [55, 100], [-10, 75], [-70, 95], [-100, 30], [-60, -30], [-85, -70]],
    width: 7, laps: 3, grip: 0.8,
    theme: { sky: 0xb8f5c8, fog: 0x9fe8b8, ground: 0x3fae62, road: 0x8a6f4d, curbA: "#ffd23f", curbB: "#2f7d46", accent: 0xff5ca8, decor: "jungle" },
    hills: [{ at: 0.5, w: 0.035, h: 6 }],
    ramps: [{ at: 0.2, len: 0.03, h: 5 }, { at: 0.85, len: 0.03, h: 5 }],
    moving: true,
  },
  {
    id: "toy-factory", name: "Toy Factory", desc: "Giant blocks, conveyor belts and wrapping-paper straights.",
    points: [[-90, 0], [-60, -60], [0, -85], [60, -60], [90, 0], [60, 60], [0, 85], [-60, 60]],
    width: 7.5, laps: 3, grip: 1,
    theme: { sky: 0xffd9b0, fog: 0xffc890, ground: 0xe8a25e, road: 0xc94f4f, curbA: "#ffd23f", curbB: "#2dd4c8", accent: 0x8b5cf6, decor: "toy" },
    hills: [{ at: 0.25, w: 0.02, h: 3 }],
    ramps: [{ at: 0.75, len: 0.04, h: 6 }],
    moving: true,
  },
  {
    id: "sky-highway", name: "Sky Highway", desc: "Cloud-top autobahn with trampoline skybridges.",
    points: [[0, -110], [80, -80], [110, 0], [80, 80], [0, 110], [-80, 80], [-110, 0], [-80, -80]],
    width: 6, laps: 3, grip: 1,
    theme: { sky: 0x87ceeb, fog: 0xbfe8ff, ground: 0xffffff, road: 0x8b93a8, curbA: "#ff5ca8", curbB: "#ffd23f", accent: 0x2dd4c8, decor: "sky" },
    hills: [{ at: 0.3, w: 0.04, h: 8 }, { at: 0.8, w: 0.04, h: 8 }],
    ramps: [{ at: 0.55, len: 0.045, h: 9 }],
    moving: false,
  },
  {
    id: "volcano-speedway", name: "Volcano Speedway", desc: "Lava rivers, ash storms and one very rude geyser.",
    points: [[0, -95], [70, -60], [95, 10], [55, 70], [0, 95], [-60, 75], [-100, 10], [-70, -55]],
    width: 7, laps: 3, grip: 0.95,
    theme: { sky: 0xff9a5c, fog: 0xe86a3c, ground: 0x4a3440, road: 0x2e2430, curbA: "#ff4d6d", curbB: "#ffd23f", accent: 0xff7f2a, decor: "volcano" },
    hills: [{ at: 0.4, w: 0.03, h: 5 }],
    ramps: [{ at: 0.15, len: 0.03, h: 6 }, { at: 0.7, len: 0.03, h: 6 }],
    moving: true,
  },
  {
    id: "penguin-ice-road", name: "Penguin Ice Road", desc: "VERY slippery. Penguins not included, but they're watching.",
    points: [[0, -85], [60, -70], [90, -10], [60, 50], [90, 90], [20, 100], [-50, 80], [-90, 40], [-60, -20], [-85, -60]],
    width: 7, laps: 3, grip: 0.45,
    theme: { sky: 0xdff4ff, fog: 0xcfe9fa, ground: 0xeaf7ff, road: 0x9fd4e8, curbA: "#2f6fb2", curbB: "#ffffff", accent: 0xff7f2a, decor: "ice" },
    hills: [{ at: 0.6, w: 0.03, h: 3 }],
    ramps: [{ at: 0.3, len: 0.035, h: 4 }],
    moving: false,
  },
  {
    id: "alien-circuit", name: "Alien Crazy Circuit", desc: "Anti-gravity loops on a glowing purple moon.",
    points: [[0, -90], [75, -75], [100, 15], [45, 60], [70, 105], [-10, 85], [-80, 100], [-100, 30], [-45, -10], [-75, -60]],
    width: 6.5, laps: 3, grip: 1.1,
    theme: { sky: 0x2a1b4d, fog: 0x3c2a66, ground: 0x5b3fa8, road: 0x241a3d, curbA: "#b6f34d", curbB: "#2dd4c8", accent: 0xb6f34d, decor: "alien" },
    hills: [{ at: 0.25, w: 0.03, h: 7 }, { at: 0.65, w: 0.03, h: 7 }],
    ramps: [{ at: 0.45, len: 0.035, h: 7 }, { at: 0.9, len: 0.035, h: 7 }],
    moving: true,
  },
] as const;

export function trackById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

export interface Mode { id: string; name: string; desc: string; laps: number; }

export const MODES: readonly Mode[] = [
  { id: "quick", name: "Quick Race", desc: "3 laps vs 5 CPU rivals", laps: 3 },
  { id: "grandprix", name: "Grand Prix", desc: "3-race cup — championship points", laps: 3 },
  { id: "elimination", name: "Elimination", desc: "Last place gets YEETED every lap", laps: 3 },
  { id: "team", name: "Team Racing", desc: "3v3 squad points battle", laps: 3 },
  { id: "chaos", name: "Chaos Mode", desc: "Double items + random events every 15 s", laps: 3 },
  { id: "time", name: "Time Trial", desc: "5 flying laps against the leaderboard", laps: 5 },
  { id: "practice", name: "Practice", desc: "Free-roam any track", laps: 0 },
  { id: "friends", name: "Friends Room", desc: "Real online P2P multiplayer (room codes)", laps: 3 },
] as const;

export function modeById(id: string): Mode {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}

/** Grand Prix cup: 3 tracks, championship points */
export const GP_TRACKS: string[] = ["candy-rush", "banana-jungle", "volcano-speedway"];
export const GP_POINTS: number[] = [25, 18, 15, 12, 10, 8, 6, 5, 4, 3, 2, 1];

// ---------------------------------------------------------------------------
// Power-ups (10)
// ---------------------------------------------------------------------------

export interface Powerup { id: string; name: string; desc: string; color: string; }

export const POWERUPS: readonly Powerup[] = [
  { id: "rocket", name: "Rocket Boost", desc: "HUGE forward boost", color: "#ff4d6d" },
  { id: "banana", name: "Banana Trap", desc: "Drop a slippery peel behind you", color: "#ffd23f" },
  { id: "punch", name: "Mega Punch", desc: "Boost + shove everyone nearby", color: "#ff7f2a" },
  { id: "magnet", name: "Coin Magnet", desc: "Pulls coins and boxes to you", color: "#ff5ca8" },
  { id: "shield", name: "Bubble Shield", desc: "Immune to hazards for 8 s", color: "#66e0ff" },
  { id: "freeze", name: "Freeze Bomb", desc: "Freezes rivals ahead of you", color: "#9bf0ff" },
  { id: "giant", name: "Giant Mode", desc: "Become HUGE and unstoppable", color: "#b6f34d" },
  { id: "chicken", name: "Turbo Chicken", desc: "A homing poultry missile", color: "#fff8ef" },
  { id: "reverse", name: "Reverse Controls", desc: "Reverses everyone else's steering", color: "#c792ff" },
  { id: "teleport", name: "Teleport Surprise", desc: "Swap places with a random rival", color: "#8b5cf6" },
] as const;

export function powerupById(id: string): Powerup {
  return POWERUPS.find((p) => p.id === id) ?? POWERUPS[0];
}

/** Position-balanced item roll: leaders get bananas, last place gets rockets. */
export function rollItem(position: number, fieldSize: number, rng: () => number = Math.random): string {
  const t = fieldSize <= 1 ? 0.5 : (position - 1) / Math.max(1, fieldSize - 1); // 0 = leader, 1 = last
  const table: [number, string][] = [
    [0.15, "rocket"],
    [0.30, "punch"],
    [0.42, "giant"],
    [0.52, "chicken"],
    [0.60, "magnet"],
    [0.68, "teleport"],
    [0.76, "shield"],
    [0.84, "freeze"],
    [0.92, "reverse"],
    [1.01, "banana"],
  ];
  // map t onto the table reversed: last place -> rocket
  const idx = Math.min(table.length - 1, Math.floor((1 - t) * table.length));
  void rng;
  return table[idx][1];
}

// ---------------------------------------------------------------------------
// Upgrades / tuning
// ---------------------------------------------------------------------------

export type UpgradeKey = "engine" | "tires" | "turbo" | "frame";

export interface UpgradeDef { key: UpgradeKey; name: string; desc: string; baseCost: number; }

export const UPGRADES: readonly UpgradeDef[] = [
  { key: "engine", name: "Engine", desc: "+Top speed, +Acceleration", baseCost: 300 },
  { key: "tires", name: "Tires", desc: "+Handling, +Drift", baseCost: 260 },
  { key: "turbo", name: "Turbo", desc: "+Acceleration, +Drift", baseCost: 340 },
  { key: "frame", name: "Frame", desc: "−Weight, +Handling", baseCost: 300 },
] as const;

export const MAX_UPGRADE_LEVEL = 5;

/** Cost of buying `level` (1..5) of `key` on `veh` — scales with level & rarity. */
export function upgradeCost(veh: Vehicle, key: UpgradeKey, level: number): number {
  const def = UPGRADES.find((u) => u.key === key) ?? UPGRADES[0];
  return Math.round(def.baseCost * level * RARITY_MULT[veh.rarity]);
}

/** Effective stat multipliers from upgrade levels (engine consumes these). */
export function upgradeMultipliers(upg: Record<string, number> | undefined): {
  maxSpeed: number; accel: number; handling: number; driftCharge: number; mass: number;
} {
  const l = (k: UpgradeKey) => Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Math.floor(upg?.[k] ?? 0)));
  const engine = l("engine"), tires = l("tires"), turbo = l("turbo"), frame = l("frame");
  return {
    maxSpeed: 1 + engine * 0.06,
    accel: 1 + engine * 0.08 + turbo * 0.08,
    handling: 1 + tires * 0.04 + frame * 0.04,
    driftCharge: 1 + tires * 0.06 + turbo * 0.06,
    mass: Math.max(0.5, 1 - frame * 0.06),
  };
}

// ---------------------------------------------------------------------------
// Shop: crates, bundles, gem exchange
// ---------------------------------------------------------------------------

export interface Crate { id: string; name: string; desc: string; currency: "coins" | "gems"; price: number; odds: Record<Rarity, number>; }

export const CRATES: readonly Crate[] = [
  { id: "rusty", name: "Rusty Crate", desc: "Smells like a barn. Mostly commons.", currency: "coins", price: 500, odds: { common: 70, rare: 25, epic: 5, legendary: 0 } },
  { id: "turbo", name: "Turbo Crate", desc: "Nitro-scented. Great rares.", currency: "coins", price: 1500, odds: { common: 30, rare: 45, epic: 20, legendary: 5 } },
  { id: "legend", name: "Legend Crate", desc: "Paid in gems. Epic+ only.", currency: "gems", price: 60, odds: { common: 0, rare: 20, epic: 45, legendary: 35 } },
] as const;

export interface BundleItem { kind: "vehicles" | "characters" | "hats" | "wheels" | "horns" | "dances"; id: string; }
export interface Bundle { id: string; name: string; desc: string; coins: number; gems?: number; items: BundleItem[]; bonusCoins?: number; }

export const BUNDLES: readonly Bundle[] = [
  { id: "chaos-starter", name: "Chaos Starter", desc: "Two quick commons + a party hat", coins: 1500, items: [{ kind: "vehicles", id: "pizza-scooter" }, { kind: "vehicles", id: "skateboard-supreme" }, { kind: "hats", id: "party" }] },
  { id: "heavy-metal", name: "Heavy Metal Garage", desc: "Monster Truck + Mini Tank + off-road wheels", coins: 18000, items: [{ kind: "vehicles", id: "monster-truck" }, { kind: "vehicles", id: "mini-tank" }, { kind: "wheels", id: "offroad" }] },
  { id: "sky-high", name: "Sky High", desc: "Flying Carpet + Hot Air Kart", coins: 24000, gems: 45, items: [{ kind: "vehicles", id: "flying-carpet" }, { kind: "vehicles", id: "hot-air-kart" }] },
  { id: "legend-vault", name: "Legend Vault", desc: "All three legendaries + bonus coins", coins: 100000, gems: 420, bonusCoins: 5000, items: [{ kind: "vehicles", id: "dino-stomper" }, { kind: "vehicles", id: "ufo-saucer" }, { kind: "vehicles", id: "golden-chariot" }] },
] as const;

export interface GemPack { id: string; name: string; coins: number; gems: number; }

export const GEM_EXCHANGE: readonly GemPack[] = [
  { id: "pouch", name: "Gem Pouch", coins: 1000, gems: 12 },
  { id: "bag", name: "Gem Bag", coins: 4500, gems: 65 },
  { id: "vault", name: "Gem Vault", coins: 9000, gems: 150 },
] as const;

// ---------------------------------------------------------------------------
// Dailies & achievements
// ---------------------------------------------------------------------------

export interface DailyDef { id: string; name: string; desc: string; target: number; reward: number; }

export const DAILIES: readonly DailyDef[] = [
  { id: "win_race", name: "Winner Winner", desc: "Win a race", target: 1, reward: 120 },
  { id: "collect_coins", name: "Coin Goblin", desc: "Collect 30 coins in races", target: 30, reward: 60 },
  { id: "drift_time", name: "Sideways Sam", desc: "Drift for 10 s total", target: 10, reward: 80 },
  { id: "use_powerups", name: "Button Masher", desc: "Use 3 power-ups", target: 3, reward: 80 },
  { id: "finish_races", name: "Regular", desc: "Finish 2 races", target: 2, reward: 60 },
] as const;

export interface Achievement { id: string; name: string; desc: string; }

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first-race", name: "Rookie Wheels", desc: "Finish your first race" },
  { id: "first-win", name: "First Win", desc: "Win a race" },
  { id: "podium", name: "Podium Finisher", desc: "Finish on the podium" },
  { id: "collector", name: "Collector", desc: "Own 10 vehicles" },
  { id: "completionist", name: "Completionist", desc: "Own all 20 vehicles" },
  { id: "master-tuner", name: "Master Tuner", desc: "Buy 20 upgrade levels" },
  { id: "drifter", name: "Drift King", desc: "Drift for 60 s total" },
  { id: "coin-hoarder", name: "Coin Hoarder", desc: "Collect 500 coins" },
  { id: "chaos-survivor", name: "Chaos Survivor", desc: "Win a Chaos Mode race" },
] as const;

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export function fmtTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const c = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

/** level = √(xp/60) + 1 */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 60) + 1);
}

export function xpForLevel(level: number): number {
  const l = Math.max(1, level - 1);
  return Math.round(l * l * 60);
}
