// ============================================================================
// WACKY RACING: ULTIMATE KART CHAOS — static game data (100% original content)
// ============================================================================

export type Vec2 = [number, number];

export type Rarity = "common" | "rare" | "epic" | "legendary";

export const RARITY_META: Record<Rarity, { name: string; color: string; glow: string; order: number }> = {
  common: { name: "Common", color: "#9fb4c7", glow: "#dfe9f2", order: 0 },
  rare: { name: "Rare", color: "#2dd4c8", glow: "#bff6f1", order: 1 },
  epic: { name: "Epic", color: "#a06cd5", glow: "#e2cdf7", order: 2 },
  legendary: { name: "Legendary", color: "#ffb700", glow: "#ffeaa8", order: 3 },
};

export type VehicleClass = "Light" | "Balanced" | "Heavy" | "Speed" | "Drift";

export interface VehicleDef {
  id: string;
  name: string;
  desc: string;
  accel: number; // 1..10
  top: number;
  handling: number;
  drift: number;
  weight: number;
  color: string;
  price: number; // coins, 0 = free
  gems?: number; // optional premium price
  rarity: Rarity;
  cls: VehicleClass;
  ability: { name: string; desc: string };
}

export const VEHICLES: VehicleDef[] = [
  // ---------------- COMMON (starters & cheap unlocks) ----------------
  { id: "shopping-cart", name: "Shopping Cart", desc: "Stolen from the parking lot. Wheels pointed in four directions.", accel: 6, top: 5, handling: 9, drift: 7, weight: 3, color: "#9fb4c7", price: 0, rarity: "common", cls: "Light",
    ability: { name: "Express Lane", desc: "Item boxes recharge 35% faster for you." } },
  { id: "chicken-bike", name: "Chicken Bike", desc: "Half bicycle, half poultry. Do not ask how it lays eggs at speed.", accel: 8, top: 5, handling: 8, drift: 6, weight: 2, color: "#f6e7c1", price: 0, rarity: "common", cls: "Light",
    ability: { name: "Egg Drop", desc: "Drifting sometimes lays a slippery egg trap behind you." } },
  { id: "pizza-scooter", name: "Pizza Scooter", desc: "Guaranteed to finish in 30 minutes or your position back.", accel: 7, top: 6, handling: 7, drift: 6, weight: 4, color: "#e4572e", price: 0, rarity: "common", cls: "Balanced",
    ability: { name: "Hot Delivery", desc: "20% extra acceleration on lap one. The pizza MUST be warm." } },
  { id: "skateboard", name: "Skateboard Supreme", desc: "No seat, no brakes, no regrets. Just vibes and road rash.", accel: 9, top: 5, handling: 9, drift: 8, weight: 1, color: "#ff5ca8", price: 250, rarity: "common", cls: "Light",
    ability: { name: "Kickflip", desc: "Ramps launch you higher and award instant trick boosts." } },
  { id: "lawn-mower", name: "Lawn Mower Menace", desc: "Cuts grass at 90 km/h. The lawn did not consent.", accel: 6, top: 6, handling: 6, drift: 5, weight: 6, color: "#7bc950", price: 320, rarity: "common", cls: "Balanced",
    ability: { name: "Grass Clippings", desc: "Driving off-track costs you far less speed." } },

  // ---------------- RARE ----------------
  { id: "bathtub-racer", name: "Bathtub Racer", desc: "Cleanest kart on the grid. Comes with a shower curtain spoiler.", accel: 6, top: 6, handling: 6, drift: 9, weight: 4, color: "#bfe8ef", price: 400, rarity: "rare", cls: "Drift",
    ability: { name: "Bubble Bath", desc: "Perfect drift releases have a chance to grant a soap shield." } },
  { id: "rocket-scooter", name: "Rocket Scooter", desc: "A scooter with a rocket welded to it. Safety third!", accel: 4, top: 10, handling: 5, drift: 5, weight: 5, color: "#d64545", price: 450, rarity: "rare", cls: "Speed",
    ability: { name: "Afterburner", desc: "All boosts last 40% longer. Science!" } },
  { id: "toaster-turbo", name: "Toaster Turbo", desc: "Two slices of raw speed. Pops you forward when done.", accel: 7, top: 7, handling: 6, drift: 6, weight: 5, color: "#c8ccd4", price: 500, rarity: "rare", cls: "Balanced",
    ability: { name: "Pop-Up Launch", desc: "Press drift while stopped or slow for a toast-powered hop." } },
  { id: "banana-mobile", name: "Banana Mobile", desc: "Aerodynamic? No. Potassium-rich? Extremely.", accel: 6, top: 7, handling: 6, drift: 10, weight: 4, color: "#ffd23f", price: 550, rarity: "rare", cls: "Drift",
    ability: { name: "Potassium Power", desc: "Drift mini-turbos are 50% stronger." } },
  { id: "coffee-cruiser", name: "Coffee Cup Cruiser", desc: "Extra hot, extra fast, dangerously over-caffeinated.", accel: 8, top: 7, handling: 7, drift: 6, weight: 4, color: "#8d5a2b", price: 580, rarity: "rare", cls: "Speed",
    ability: { name: "Caffeine Rush", desc: "Grabbing a coin gives a tiny jolt of speed. It adds up!" } },
  { id: "rubber-duck", name: "Rubber Duck Car", desc: "Squeaks when it brakes. Floats in water. Untested in court.", accel: 7, top: 6, handling: 7, drift: 7, weight: 3, color: "#ffd23f", price: 600, rarity: "rare", cls: "Balanced",
    ability: { name: "Squeaky Bounce", desc: "Crashes bounce you forward instead of stopping you." } },
  { id: "ice-cream-truck", name: "Ice Cream Truck", desc: "Plays one jingle. Forever. The other racers have notes.", accel: 5, top: 7, handling: 5, drift: 5, weight: 8, color: "#ff9de2", price: 650, rarity: "rare", cls: "Heavy",
    ability: { name: "Brain Freeze", desc: "Rivals who bump you get briefly chilled and slow down." } },
  { id: "monster-truck", name: "Monster Truck", desc: "Arrives late to the race because it crushed the parking lot.", accel: 5, top: 7, handling: 4, drift: 4, weight: 10, color: "#7bc950", price: 700, rarity: "rare", cls: "Heavy",
    ability: { name: "Crush", desc: "Immune to banana traps and bumps rivals HARD." } },

  // ---------------- EPIC ----------------
  { id: "flying-carpet", name: "Flying Carpet", desc: "Legally distinct from any trademarked rug. Glides off jumps.", accel: 6, top: 7, handling: 8, drift: 6, weight: 2, color: "#a06cd5", price: 800, gems: 20, rarity: "epic", cls: "Light",
    ability: { name: "Magic Glide", desc: "Longer airtime and full steering control while airborne." } },
  { id: "mini-tank", name: "Mini Tank", desc: "Tiny tank. Huge confidence. Turns like a stubborn fridge.", accel: 5, top: 8, handling: 3, drift: 3, weight: 10, color: "#5a7d5a", price: 900, gems: 22, rarity: "epic", cls: "Heavy",
    ability: { name: "Armor Plating", desc: "Punches and freeze bombs barely tickle you." } },
  { id: "hot-air-kart", name: "Hot Air Kart", desc: "A balloon with a basket and an attitude problem.", accel: 6, top: 8, handling: 9, drift: 5, weight: 2, color: "#ff7f2a", price: 1100, gems: 26, rarity: "epic", cls: "Light",
    ability: { name: "Updraft", desc: "Floats gently in the air and never bottoms out on landings." } },
  { id: "submarine", name: "Submarine Racer", desc: "Wildly over-engineered for a track with zero water on it.", accel: 5, top: 9, handling: 6, drift: 6, weight: 9, color: "#2e86ab", price: 1250, gems: 30, rarity: "epic", cls: "Heavy",
    ability: { name: "Periscope Up", desc: "Shields last twice as long and pop with a torpedo blast." } },

  // ---------------- LEGENDARY ----------------
  { id: "dino-stomper", name: "Dino Stomper", desc: "Extinct? Only on paper. Still rules the asphalt. ROAR.", accel: 7, top: 9, handling: 5, drift: 6, weight: 10, color: "#3ddc84", price: 2200, gems: 55, rarity: "legendary", cls: "Heavy",
    ability: { name: "Prehistoric Stomp", desc: "Landing from big jumps shockwaves nearby rivals away." } },
  { id: "ufo-saucer", name: "UFO Saucer", desc: "Abducted from a racing museum. By itself. Suspicious.", accel: 8, top: 9, handling: 10, drift: 7, weight: 3, color: "#64ffda", price: 2600, gems: 65, rarity: "legendary", cls: "Speed",
    ability: { name: "Tractor Beam", desc: "Coins and item boxes are magnetically pulled toward you." } },
  { id: "golden-chariot", name: "Golden Chariot", desc: "Pulled by pure ego. The wheels are solid applause.", accel: 9, top: 10, handling: 7, drift: 8, weight: 6, color: "#ffd700", price: 3500, gems: 80, rarity: "legendary", cls: "Speed",
    ability: { name: "Champion's Aura", desc: "Earn +15% bonus coins from every race you finish." } },
];

export interface CharacterDef {
  id: string;
  name: string;
  desc: string;
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  voice: number; // pitch multiplier
  price: number;
}

export const CHARACTERS: CharacterDef[] = [
  { id: "captain-noodle", name: "Captain Noodle", desc: "Retired pirate. Now plunders podium finishes.", skin: "#f2c48d", shirt: "#26418f", pants: "#6b4a2f", hair: "#3a2a1a", voice: 0.8, price: 0 },
  { id: "granny-turbo", name: "Granny Turbo", desc: "Knits at 200 km/h. Do not underestimate the cardigan.", skin: "#f0c99f", shirt: "#b565a7", pants: "#7a7a8c", hair: "#dcdcdc", voice: 1.3, price: 0 },
  { id: "professor-wobble", name: "Professor Wobble", desc: "Invented square wheels. Twice. On purpose.", skin: "#e8b98a", shirt: "#f5f5f5", pants: "#4a4a4a", hair: "#efefef", voice: 1.0, price: 250 },
  { id: "disco-dan", name: "Disco Dan", desc: "Legally required to dance at all times, even mid-race.", skin: "#c68e5e", shirt: "#ff7ad9", pants: "#7b2ff7", hair: "#2b1a12", voice: 0.9, price: 350 },
  { id: "agent-pickle", name: "Agent Pickle", desc: "In a brine of international espionage. Delicious espionage.", skin: "#a8d164", shirt: "#2f3b2f", pants: "#2f3b2f", hair: "#1c241c", voice: 0.7, price: 400 },
  { id: "princess-sprinkles", name: "Princess Sprinkles", desc: "Rules the Candy Kingdom with an iron cupcake.", skin: "#f6d3b8", shirt: "#ff9de2", pants: "#ffd6f2", hair: "#ffcd5c", voice: 1.5, price: 400 },
  { id: "robo-beep", name: "Robo-Beep", desc: "Runs on friendship and two AA batteries.", skin: "#c9d6df", shirt: "#63d2ff", pants: "#4a6b7c", hair: "#c9d6df", voice: 1.1, price: 550 },
  { id: "moose", name: "Moose", desc: "Nobody knows how Moose got a racing license. Moose knows.", skin: "#b5824f", shirt: "#2e86ab", pants: "#3d3d3d", hair: "#6b4526", voice: 0.6, price: 500 },
];

export const HATS = [
  { id: "none", name: "Bare Head", price: 0, color: "" },
  { id: "cowboy", name: "Yeehaw Hat", price: 120, color: "#8b5a2b" },
  { id: "party", name: "Party Cone", price: 150, color: "#ff5ca8" },
  { id: "cone", name: "Traffic Cone", price: 200, color: "#ff7f2a" },
  { id: "pan", name: "Frying Pan", price: 250, color: "#44484f" },
  { id: "propeller", name: "Propeller Cap", price: 300, color: "#ff4d4d" },
  { id: "viking", name: "Viking Helmet", price: 320, color: "#c8ccd4" },
  { id: "duck-hat", name: "Duck Hat", price: 350, color: "#ffd23f" },
  { id: "crown", name: "Winner Crown", price: 500, color: "#ffd700" },
] as const;

export const WHEELS = [
  { id: "classic", name: "Classic Wheels", price: 0 },
  { id: "slick", name: "Pink Slicks", price: 220 },
  { id: "monster", name: "Monster Tires", price: 280 },
  { id: "donut", name: "Donut Tires", price: 340 },
] as const;

export const HORNS = [
  { id: "party", name: "Party Horn", price: 0 },
  { id: "clown", name: "Clown Horn", price: 180 },
  { id: "quack", name: "Mega Quack", price: 260 },
  { id: "fanfare", name: "Royal Fanfare", price: 320 },
] as const;

export const DANCES = [
  { id: "spin", name: "Victory Spin", price: 0 },
  { id: "worm", name: "The Worm", price: 240 },
  { id: "robot", name: "The Robot", price: 280 },
  { id: "floss", name: "The Floss", price: 280 },
] as const;

export const PAINTS = ["#e4572e", "#ffd23f", "#28c76f", "#2e86ab", "#a06cd5", "#ff5ca8", "#f28f3b", "#21293c", "#f5f5f5", "#00d4d8"];

// ---------------------------------------------------------------------------
// Dealership: crates, bundles, gem packs
// ---------------------------------------------------------------------------
export interface CrateDef {
  id: string;
  name: string;
  desc: string;
  currency: "coins" | "gems";
  price: number;
  color: string;
  /** chance weights per rarity for the vehicle/cosmetic roll */
  odds: Record<Rarity, number>;
}

export const CRATES: CrateDef[] = [
  {
    id: "rusty", name: "Rusty Crate", desc: "Mostly common parts, occasionally something shiny.",
    currency: "coins", price: 400, color: "#9fb4c7",
    odds: { common: 62, rare: 30, epic: 7, legendary: 1 },
  },
  {
    id: "turbo", name: "Turbo Crate", desc: "Better odds, bigger grins. Rare or better guaranteed.",
    currency: "coins", price: 1200, color: "#2dd4c8",
    odds: { common: 0, rare: 68, epic: 27, legendary: 5 },
  },
  {
    id: "legend", name: "Legend Crate", desc: "Epic or legendary. Guaranteed. No junk, all glory.",
    currency: "gems", price: 45, color: "#ffb700",
    odds: { common: 0, rare: 0, epic: 76, legendary: 24 },
  },
];

export interface BundleDef {
  id: string;
  name: string;
  desc: string;
  items: { kind: "vehicles" | "characters" | "hats" | "wheels" | "horns" | "dances"; id: string }[];
  coins: number; // bundle price in coins (0 = gems only)
  gems?: number;
  bonusCoins?: number;
  color: string;
}

export const BUNDLES: BundleDef[] = [
  {
    id: "starter-chaos", name: "Chaos Starter Pack", desc: "Two rare rides plus a party hat and squeaky horn. Great value!",
    items: [
      { kind: "vehicles", id: "bathtub-racer" },
      { kind: "vehicles", id: "toaster-turbo" },
      { kind: "hats", id: "party" },
      { kind: "horns", id: "clown" },
    ],
    coins: 820, color: "#2dd4c8",
  },
  {
    id: "heavy-metal", name: "Heavy Metal Garage", desc: "Monster Truck + Ice Cream Truck + Monster Tires. Maximum tonnage.",
    items: [
      { kind: "vehicles", id: "monster-truck" },
      { kind: "vehicles", id: "ice-cream-truck" },
      { kind: "wheels", id: "monster" },
    ],
    coins: 1250, color: "#ff7f2a",
  },
  {
    id: "sky-high", name: "Sky High Collection", desc: "Flying Carpet, Hot Air Kart and a propeller cap. Gravity optional.",
    items: [
      { kind: "vehicles", id: "flying-carpet" },
      { kind: "vehicles", id: "hot-air-kart" },
      { kind: "hats", id: "propeller" },
    ],
    coins: 1700, gems: 42, color: "#a06cd5",
  },
  {
    id: "legend-vault", name: "Legend Vault", desc: "Dino Stomper, UFO Saucer and the Winner Crown. Flex responsibly.",
    items: [
      { kind: "vehicles", id: "dino-stomper" },
      { kind: "vehicles", id: "ufo-saucer" },
      { kind: "hats", id: "crown" },
    ],
    coins: 4200, gems: 99, color: "#ffb700",
  },
];

/** Gems are earned, never sold for real money — this game has no real-money store. */
export interface GemPackDef { id: string; name: string; gems: number; coins: number; desc: string }

export const GEM_EXCHANGE: GemPackDef[] = [
  { id: "gems-10", name: "Pocket Gems", gems: 10, coins: 900, desc: "Trade racing coins for shiny gems." },
  { id: "gems-25", name: "Gem Stack", gems: 25, coins: 2000, desc: "Better rate. More sparkle." },
  { id: "gems-60", name: "Gem Hoard", gems: 60, coins: 4200, desc: "Best rate for dedicated collectors." },
];

// ---------------------------------------------------------------------------
// Upgrade system — earned with coins, applies per-vehicle, capped at level 5
// ---------------------------------------------------------------------------
export type UpgradeKey = "engine" | "tires" | "turbo" | "frame";

export interface UpgradeDef {
  key: UpgradeKey;
  name: string;
  desc: string;
  icon: string;
  color: string;
  /** stat deltas applied per level (added to the 1..10 display stats) */
  affects: { stat: "accel" | "top" | "handling" | "drift" | "weight"; per: number }[];
}

export const UPGRADES: UpgradeDef[] = [
  { key: "engine", name: "Engine", desc: "More horses. Possibly literal horses.", icon: "engine", color: "#ff7f2a",
    affects: [{ stat: "top", per: 0.4 }, { stat: "accel", per: 0.2 }] },
  { key: "tires", name: "Tires", desc: "Grippier rubber for sharper cornering.", icon: "tires", color: "#2dd4c8",
    affects: [{ stat: "handling", per: 0.45 }, { stat: "drift", per: 0.15 }] },
  { key: "turbo", name: "Turbo", desc: "Bigger, louder, bluer boost flames.", icon: "turbo", color: "#ff5ca8",
    affects: [{ stat: "accel", per: 0.45 }, { stat: "drift", per: 0.2 }] },
  { key: "frame", name: "Frame", desc: "Lighter chassis — nimbler, but keeps its punch.", icon: "frame", color: "#a06cd5",
    affects: [{ stat: "weight", per: -0.3 }, { stat: "handling", per: 0.2 }] },
];

export const MAX_UPGRADE_LEVEL = 5;

export type VehicleUpgrades = Record<UpgradeKey, number>;
export type UpgradeMap = Record<string, Partial<VehicleUpgrades>>;

export const EMPTY_UPGRADES: VehicleUpgrades = { engine: 0, tires: 0, turbo: 0, frame: 0 };

/** Cost scales with level AND the car's rarity, so legendaries cost more to max. */
export function upgradeCost(veh: VehicleDef, key: UpgradeKey, nextLevel: number): number {
  const rarityMul = { common: 1, rare: 1.35, epic: 1.8, legendary: 2.4 }[veh.rarity];
  const base = 140 + (nextLevel - 1) * 130;
  void key;
  return Math.round(base * rarityMul);
}

export function getUpgrades(map: UpgradeMap | undefined, vehId: string): VehicleUpgrades {
  const u = map?.[vehId];
  return { ...EMPTY_UPGRADES, ...(u ?? {}) };
}

export function upgradeTotal(u: VehicleUpgrades): number {
  return u.engine + u.tires + u.turbo + u.frame;
}

/** Display stats (1..10-ish) after upgrades are applied. */
export function upgradedStats(veh: VehicleDef, u: VehicleUpgrades) {
  const s = { accel: veh.accel, top: veh.top, handling: veh.handling, drift: veh.drift, weight: veh.weight };
  for (const def of UPGRADES) {
    const lvl = u[def.key] ?? 0;
    if (!lvl) continue;
    for (const a of def.affects) s[a.stat] = s[a.stat] + a.per * lvl;
  }
  return {
    accel: Math.min(10, Math.round(s.accel * 10) / 10),
    top: Math.min(10, Math.round(s.top * 10) / 10),
    handling: Math.min(10, Math.round(s.handling * 10) / 10),
    drift: Math.min(10, Math.round(s.drift * 10) / 10),
    weight: Math.max(1, Math.round(s.weight * 10) / 10),
  };
}

export const vehicleById = (id: string): VehicleDef | undefined => VEHICLES.find((v) => v.id === id);

export function collectionStats(owned: string[]) {
  const total = VEHICLES.length;
  const have = VEHICLES.filter((v) => owned.includes(v.id)).length;
  const byRarity = (Object.keys(RARITY_META) as Rarity[]).map((r) => {
    const all = VEHICLES.filter((v) => v.rarity === r);
    return { rarity: r, have: all.filter((v) => owned.includes(v.id)).length, total: all.length };
  });
  return { have, total, pct: Math.round((have / total) * 100), byRarity };
}

/** Total stat rating used for sorting / display in the dealership. */
export const vehicleRating = (v: VehicleDef): number =>
  Math.round(((v.accel + v.top + v.handling + v.drift + (11 - v.weight)) / 50) * 100);

// ---------------------------------------------------------------------------
// Power-ups
// ---------------------------------------------------------------------------
export type PowerId =
  | "boost" | "banana" | "punch" | "magnet" | "shield"
  | "freeze" | "giant" | "chicken" | "reverse" | "teleport";

export interface PowerDef { id: PowerId; name: string; color: string; desc: string; }

export const POWERUPS: PowerDef[] = [
  { id: "boost", name: "Rocket Boost", color: "#ff6b35", desc: "Hold on. No, REALLY hold on." },
  { id: "banana", name: "Banana Trap", color: "#ffd23f", desc: "Drop it. Watch the chaos." },
  { id: "punch", name: "Mega Punch", color: "#ff4d6d", desc: "A giant boxing glove on a spring. Classic." },
  { id: "magnet", name: "Coin Magnet", color: "#ffe066", desc: "Coins fly at your face. Income!" },
  { id: "shield", name: "Bubble Shield", color: "#66e0ff", desc: "Pop-proof soapy protection." },
  { id: "freeze", name: "Freeze Bomb", color: "#9bf0ff", desc: "Chills everyone ahead of you. Literally." },
  { id: "giant", name: "Giant Mode", color: "#b6f34d", desc: "Become BIG. Squash responsibilities and rivals." },
  { id: "chicken", name: "Turbo Chicken", color: "#f6e7c1", desc: "A homing poultry missile. It knows what you did." },
  { id: "reverse", name: "Reverse Controls", color: "#c792ff", desc: "Scrambles a rival's steering. Evil. Funny." },
  { id: "teleport", name: "Teleport Surprise", color: "#64ffda", desc: "Skip ahead. Where? Surprise!" },
];

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------
export interface ObstacleDef { type: "spinner" | "mover" | "bouncer"; at: number; lane: number; speed?: number; }
export interface RampDef { at: number; lane: number; }

export interface TrackDef {
  id: string;
  name: string;
  desc: string;
  points: Vec2[];
  width: number;
  laps: number;
  slippery: number; // 0 normal grip .. 1 ice
  theme: {
    sky: string; horizon: string; ground: string; track: string; curbA: string; curbB: string;
    fog: string; fogNear: number; fogFar: number; decor: "candy" | "porcelain" | "jungle" | "toy" | "sky" | "volcano" | "ice" | "alien";
  };
  obstacles: ObstacleDef[];
  ramps: RampDef[];
  pickups: number[]; // t positions of item box rows
  coinRows: { at: number; lanes: number[] }[];
}

export const TRACKS: TrackDef[] = [
  {
    id: "candy-rush", name: "Candy Rush", desc: "A sugar-coated sprint through the Candy Kingdom. Watch for the gummy hammers!",
    width: 13, laps: 3, slippery: 0,
    points: [[0,-100],[60,-95],[100,-60],[110,-10],[90,40],[100,90],[55,110],[0,95],[-50,110],[-95,75],[-110,20],[-85,-30],[-100,-70],[-50,-85]],
    theme: { sky: "#ffd6f2", horizon: "#ffb3e6", ground: "#8ee6a0", track: "#ff9de2", curbA: "#ffffff", curbB: "#ff5ca8", fog: "#ffd6f2", fogNear: 140, fogFar: 420, decor: "candy" },
    obstacles: [
      { type: "spinner", at: 0.22, lane: 0, speed: 1.4 },
      { type: "mover", at: 0.55, lane: 0, speed: 1 },
      { type: "bouncer", at: 0.8, lane: -3, speed: 1.2 },
    ],
    ramps: [{ at: 0.4, lane: 0 }, { at: 0.92, lane: 3.5 }],
    pickups: [0.08, 0.3, 0.48, 0.68, 0.88],
    coinRows: [{ at: 0.15, lanes: [-3, 0, 3] }, { at: 0.36, lanes: [-4, -2, 0, 2, 4] }, { at: 0.62, lanes: [-3, 0, 3] }, { at: 0.86, lanes: [-2, 0, 2] }],
  },
  {
    id: "toilet-town", name: "Toilet Town", desc: "The porcelain capital of the world. Plungers the size of oak trees. Bring a mop.",
    width: 12, laps: 3, slippery: 0.25,
    points: [[0,-95],[55,-100],[105,-70],[95,-20],[115,25],[75,60],[85,105],[30,115],[-10,80],[-55,105],[-100,85],[-90,35],[-115,-10],[-80,-50],[-50,-40],[-60,-95]],
    theme: { sky: "#c9f2ff", horizon: "#a0e4ff", ground: "#7ec8e3", track: "#f5f9ff", curbA: "#4fc3f7", curbB: "#ffffff", fog: "#c9f2ff", fogNear: 140, fogFar: 400, decor: "porcelain" },
    obstacles: [
      { type: "mover", at: 0.18, lane: 0, speed: 1.3 },
      { type: "spinner", at: 0.47, lane: 0, speed: 1.8 },
      { type: "mover", at: 0.74, lane: 0, speed: 0.9 },
    ],
    ramps: [{ at: 0.33, lane: -3 }, { at: 0.88, lane: 0 }],
    pickups: [0.1, 0.28, 0.52, 0.7, 0.9],
    coinRows: [{ at: 0.2, lanes: [-3, 0, 3] }, { at: 0.44, lanes: [-2, 0, 2] }, { at: 0.66, lanes: [-4, 0, 4] }, { at: 0.85, lanes: [-3, 0, 3] }],
  },
  {
    id: "banana-jungle", name: "Banana Jungle", desc: "Dense, humid, and 40% banana by volume. Toucans place bets on this race.",
    width: 11, laps: 3, slippery: 0,
    points: [[0,-85],[50,-105],[95,-85],[75,-45],[120,-15],[100,35],[60,45],[70,90],[25,115],[-15,90],[-60,115],[-105,85],[-75,45],[-110,10],[-90,-35],[-55,-25],[-70,-75],[-30,-60]],
    theme: { sky: "#d8f7c9", horizon: "#a9e88b", ground: "#2e8b57", track: "#c9a86a", curbA: "#ffd23f", curbB: "#1f6b3a", fog: "#d8f7c9", fogNear: 130, fogFar: 380, decor: "jungle" },
    obstacles: [
      { type: "bouncer", at: 0.15, lane: 2, speed: 1.4 },
      { type: "mover", at: 0.38, lane: 0, speed: 1.2 },
      { type: "spinner", at: 0.63, lane: 0, speed: 1.5 },
      { type: "bouncer", at: 0.87, lane: -3, speed: 1.1 },
    ],
    ramps: [{ at: 0.25, lane: 3.5 }, { at: 0.55, lane: 0 }, { at: 0.78, lane: -3.5 }],
    pickups: [0.06, 0.3, 0.5, 0.72, 0.94],
    coinRows: [{ at: 0.12, lanes: [-3, 0, 3] }, { at: 0.42, lanes: [-2, 0, 2] }, { at: 0.6, lanes: [-4, 0, 4] }, { at: 0.82, lanes: [-3, 0, 3] }],
  },
  {
    id: "toy-factory", name: "Toy Factory", desc: "The conveyor belts run at kart speed. So do the wind-up teeth. Good luck!",
    width: 12, laps: 3, slippery: 0,
    points: [[0,-100],[70,-95],[115,-70],[90,-30],[120,5],[110,55],[70,45],[65,95],[15,110],[-35,95],[-80,115],[-115,70],[-90,30],[-120,-15],[-100,-60],[-45,-75]],
    theme: { sky: "#e8d5ff", horizon: "#cfb0f7", ground: "#6b5dd3", track: "#f7b32b", curbA: "#ff4d6d", curbB: "#66e0ff", fog: "#e8d5ff", fogNear: 140, fogFar: 420, decor: "toy" },
    obstacles: [
      { type: "mover", at: 0.12, lane: 0, speed: 1.6 },
      { type: "mover", at: 0.34, lane: 0, speed: 1.2 },
      { type: "spinner", at: 0.58, lane: 0, speed: 2 },
      { type: "bouncer", at: 0.8, lane: 0, speed: 1.3 },
    ],
    ramps: [{ at: 0.22, lane: 0 }, { at: 0.7, lane: 3.5 }],
    pickups: [0.08, 0.26, 0.45, 0.64, 0.86],
    coinRows: [{ at: 0.18, lanes: [-3, 0, 3] }, { at: 0.4, lanes: [-2, 0, 2] }, { at: 0.62, lanes: [-4, 0, 4] }, { at: 0.92, lanes: [-3, 0, 3] }],
  },
  {
    id: "sky-highway", name: "Sky Highway", desc: "A floating freeway above the clouds. Gravity is a suggestion up here.",
    width: 11, laps: 3, slippery: 0,
    points: [[0,-110],[65,-105],[110,-75],[85,-40],[115,-5],[90,35],[105,80],[60,105],[20,75],[-5,115],[-55,110],[-95,80],[-70,40],[-110,5],[-115,-45],[-70,-60],[-60,-100],[-25,-80]],
    theme: { sky: "#7ec8ff", horizon: "#dff3ff", ground: "#8ecbff", track: "#f0f4ff", curbA: "#ffd23f", curbB: "#66e0ff", fog: "#dff3ff", fogNear: 160, fogFar: 460, decor: "sky" },
    obstacles: [
      { type: "mover", at: 0.2, lane: 0, speed: 1.1 },
      { type: "spinner", at: 0.52, lane: 0, speed: 1.6 },
      { type: "bouncer", at: 0.75, lane: 3, speed: 1.5 },
    ],
    ramps: [{ at: 0.3, lane: 0 }, { at: 0.45, lane: -3.5 }, { at: 0.66, lane: 0 }, { at: 0.9, lane: 0 }],
    pickups: [0.1, 0.34, 0.56, 0.78, 0.95],
    coinRows: [{ at: 0.16, lanes: [-3, 0, 3] }, { at: 0.48, lanes: [-4, -2, 0, 2, 4] }, { at: 0.7, lanes: [-2, 0, 2] }, { at: 0.88, lanes: [-3, 0, 3] }],
  },
  {
    id: "volcano-speedway", name: "Volcano Speedway", desc: "Freshly paved last Tuesday. The lava is decorative. Probably.",
    width: 12, laps: 3, slippery: 0,
    points: [[0,-105],[55,-95],[105,-80],[120,-30],[85,-10],[110,40],[75,80],[80,115],[30,100],[-5,120],[-55,95],[-100,105],[-115,55],[-80,20],[-105,-25],[-95,-70],[-50,-85]],
    theme: { sky: "#3d1e2e", horizon: "#8d3030", ground: "#33191a", track: "#4a4a55", curbA: "#ff7f2a", curbB: "#33191a", fog: "#3d1e2e", fogNear: 120, fogFar: 380, decor: "volcano" },
    obstacles: [
      { type: "spinner", at: 0.16, lane: 0, speed: 2.2 },
      { type: "bouncer", at: 0.4, lane: -2, speed: 1.6 },
      { type: "spinner", at: 0.6, lane: 0, speed: 1.8 },
      { type: "mover", at: 0.84, lane: 0, speed: 1.5 },
    ],
    ramps: [{ at: 0.28, lane: 3.5 }, { at: 0.5, lane: 0 }, { at: 0.9, lane: -3 }],
    pickups: [0.06, 0.32, 0.54, 0.74, 0.92],
    coinRows: [{ at: 0.22, lanes: [-3, 0, 3] }, { at: 0.46, lanes: [-2, 0, 2] }, { at: 0.68, lanes: [-4, 0, 4] }, { at: 0.88, lanes: [-3, 0, 3] }],
  },
  {
    id: "penguin-ice-road", name: "Penguin Ice Road", desc: "Slipperiest track in the league. The penguins commute across it. They have right of way.",
    width: 12, laps: 3, slippery: 0.85,
    points: [[0,-95],[60,-90],[100,-60],[115,-15],[85,20],[105,60],[70,95],[75,120],[25,105],[-15,110],[-60,90],[-105,95],[-115,45],[-85,10],[-110,-35],[-70,-65],[-35,-70]],
    theme: { sky: "#bfe9ff", horizon: "#e8f8ff", ground: "#d8f4ff", track: "#a8e4ff", curbA: "#ffffff", curbB: "#7ec8e3", fog: "#e8f8ff", fogNear: 150, fogFar: 440, decor: "ice" },
    obstacles: [
      { type: "mover", at: 0.25, lane: 0, speed: 0.8 },
      { type: "mover", at: 0.5, lane: 0, speed: 1 },
      { type: "bouncer", at: 0.72, lane: 2, speed: 1.2 },
    ],
    ramps: [{ at: 0.35, lane: 0 }, { at: 0.85, lane: 3.5 }],
    pickups: [0.1, 0.3, 0.52, 0.7, 0.9],
    coinRows: [{ at: 0.18, lanes: [-3, 0, 3] }, { at: 0.44, lanes: [-2, 0, 2] }, { at: 0.66, lanes: [-4, 0, 4] }, { at: 0.88, lanes: [-3, 0, 3] }],
  },
  {
    id: "alien-circuit", name: "Alien Crazy Circuit", desc: "Built by extraterrestrials who had never seen a road. Or physics. It shows.",
    width: 13, laps: 3, slippery: 0.15,
    points: [[0,-115],[65,-110],[115,-75],[100,-35],[125,10],[95,50],[110,95],[65,120],[10,95],[-35,120],[-85,105],[-120,65],[-95,25],[-120,-20],[-110,-65],[-60,-80],[-30,-95]],
    theme: { sky: "#2b1055", horizon: "#7597de", ground: "#1b998b", track: "#7b4b94", curbA: "#64ffda", curbB: "#2b1055", fog: "#2b1055", fogNear: 130, fogFar: 420, decor: "alien" },
    obstacles: [
      { type: "spinner", at: 0.18, lane: 0, speed: 2.4 },
      { type: "mover", at: 0.36, lane: 0, speed: 1.7 },
      { type: "bouncer", at: 0.58, lane: -3, speed: 1.8 },
      { type: "spinner", at: 0.8, lane: 0, speed: 2 },
    ],
    ramps: [{ at: 0.24, lane: 0 }, { at: 0.48, lane: -3.5 }, { at: 0.7, lane: 3.5 }, { at: 0.92, lane: 0 }],
    pickups: [0.08, 0.28, 0.44, 0.62, 0.84, 0.96],
    coinRows: [{ at: 0.14, lanes: [-3, 0, 3] }, { at: 0.4, lanes: [-4, -2, 0, 2, 4] }, { at: 0.64, lanes: [-2, 0, 2] }, { at: 0.9, lanes: [-3, 0, 3] }],
  },
];

// ---------------------------------------------------------------------------
// Game modes
// ---------------------------------------------------------------------------
export interface ModeDef { id: string; name: string; desc: string; racers: number; laps: number | "track"; tagline: string; }

export const MODES: ModeDef[] = [
  { id: "quick", name: "Quick Race", desc: "Hop in, race 5bot rivals, win glory.", racers: 6, laps: "track", tagline: "The classic" },
  { id: "grandprix", name: "Grand Prix", desc: "3 races, points for positions, one champion.", racers: 6, laps: "track", tagline: "For serious sillies" },
  { id: "elimination", name: "Elimination", desc: "Last place gets yeeted after every lap. Do not be last.", racers: 6, laps: "track", tagline: "Survive!" },
  { id: "team", name: "Team Racing", desc: "3v3 squads. Your team's points vs theirs.", racers: 6, laps: "track", tagline: "Friendship > speed" },
  { id: "chaos", name: "Chaos Mode", desc: "Double items, random wacky events every 15 seconds.", racers: 6, laps: "track", tagline: "PURE CHAOS" },
  { id: "time-trial", name: "Time Trial", desc: "You vs the clock. Ghost-free, rage optional.", racers: 1, laps: "track", tagline: "Solo zen" },
  { id: "practice", name: "Practice", desc: "Free roam. No laps, no limits, no judgment.", racers: 1, laps: 0, tagline: "Learn the tracks" },
  { id: "multiplayer", name: "Friends Room", desc: "Real P2P online racing over room codes! Host simulates CPU rivals.", racers: 6, laps: "track", tagline: "P2P online" },
];

export const GP_TRACKS = ["candy-rush", "banana-jungle", "volcano-speedway"];
export const GP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];

// ---------------------------------------------------------------------------
// Meta helpers
// ---------------------------------------------------------------------------
export const BOT_NAMES = [
  "Bot-zo the Clown", "Sir Bumpsalot", "Crash Test Daphne", "Roberto the Magnet",
  "Auntie Freeze", "Wheelie Nelson", "Dr. Skidmarks", "The Carbon Footprint",
  "Sad Trombone", "Captain Understeer", "Wally Wingspan", "Beep Boop Ben",
];

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 60)) + 1;
}

export function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 60;
}

export interface DailyDef { id: string; name: string; desc: string; target: number; reward: number; }

export const DAILIES: DailyDef[] = [
  { id: "win_race", name: "Top Banana", desc: "Win 1 race", target: 1, reward: 120 },
  { id: "collect_coins", name: "Coin Goblin", desc: "Collect 20 coins", target: 20, reward: 60 },
  { id: "drift_time", name: "Sideways Legend", desc: "Drift for 10 total seconds", target: 10, reward: 80 },
  { id: "use_powerups", name: "Chaos Dealer", desc: "Use 5 power-ups", target: 5, reward: 80 },
  { id: "finish_races", name: "Finisher", desc: "Finish 3 races", target: 3, reward: 60 },
];

export interface AchDef { id: string; name: string; desc: string; metric: string; target: number; reward: number; }

export const ACHIEVEMENTS: AchDef[] = [
  { id: "first_win", name: "Winner Winner", desc: "Win your first race", metric: "wins", target: 1, reward: 200 },
  { id: "ten_wins", name: "Serial Winner", desc: "Win 10 races", metric: "wins", target: 10, reward: 500 },
  { id: "hundred_races", name: "Road Veteran", desc: "Finish 100 races", metric: "races", target: 100, reward: 1000 },
  { id: "coin_1k", name: "Moneybags", desc: "Collect 1,000 coins in races", metric: "coinsCollected", target: 1000, reward: 400 },
  { id: "power_100", name: "Agent of Chaos", desc: "Use 100 power-ups", metric: "powerupsUsed", target: 100, reward: 300 },
  { id: "drift_500", name: "Drift Royalty", desc: "Drift for 500 total seconds", metric: "drifts", target: 500, reward: 300 },
  { id: "collector_10", name: "Collector", desc: "Own 10 different cars", metric: "carsOwned", target: 10, reward: 600 },
  { id: "collector_all", name: "Completionist", desc: "Own all 20 cars", metric: "carsOwned", target: 20, reward: 2500 },
  { id: "tuner_20", name: "Master Tuner", desc: "Buy 20 upgrade levels", metric: "upgradeLevels", target: 20, reward: 700 },
];

export const fmtTime = (ms: number): string => {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const c = Math.floor((ms % 1000) / 10);
  return `${m}:${s.toString().padStart(2, "0")}.${c.toString().padStart(2, "0")}`;
};
