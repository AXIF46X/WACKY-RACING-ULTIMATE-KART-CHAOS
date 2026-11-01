// ============================================================================
// App state (Zustand): screens, race setup, garage, settings, profile sync.
// Talks to the server API when a database is configured; otherwise falls back
// to a local profile so the game is fully playable offline.
// ============================================================================

import { create } from "zustand";
import type { P2PRoom } from "@/game/net";
import {
  MODES,
  modeById,
  levelFromXp,
  VEHICLES,
  CHARACTERS,
  HATS,
  WHEELS,
  HORNS,
  DANCES,
  BUNDLES,
  GEM_EXCHANGE,
  CRATES,
  UPGRADES,
  MAX_UPGRADE_LEVEL,
  upgradeCost,
  vehicleById,
  type Rarity,
} from "@/game/data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Screen =
  | "menu" | "tracks" | "garage" | "tune" | "shop"
  | "characters" | "settings" | "leaderboard" | "friends" | "howto";

export interface NetHandle {
  room: P2PRoom;
  role: "host" | "peer";
  invite?: string;
}

export interface RaceSetup {
  mode: string;
  track: string;
  laps: number;
  net: NetHandle | null;
  gpRace?: number;
  gpScores?: Record<string, number>;
}

export interface RaceStanding {
  name: string;
  position: number;
  isPlayer?: boolean;
  vehicleId?: string;
  color?: string;
  totalMs?: number | null;
}

export interface RaceSummary {
  mode: string;
  track: string;
  vehicleId: string;
  position: number;
  fieldSize: number;
  totalMs: number;
  bestLapMs: number | null;
  coinsCollected: number;
  powerupsUsed?: number;
  drifts?: number;
  standings: RaceStanding[];
  xpEarned?: number;
  coinsEarned?: number;
  gemsEarned?: number;
  gpScores?: Record<string, number>;
  gpDone?: boolean;
}

export interface Unlocks {
  vehicles: string[];
  characters: string[];
  hats: string[];
  wheels: string[];
  horns: string[];
  dances: string[];
}

export interface PlayerStats {
  races: number;
  wins: number;
  podiums: number;
  coinsCollected: number;
  powerupsUsed: number;
  drifts: number;
  eliminated: number;
}

export interface Dailies {
  date: string;
  progress: Record<string, number>;
  claimed: string[];
}

export interface Profile {
  id: string;
  name: string;
  xp: number;
  coins: number;
  gems: number;
  unlocked: Unlocks;
  upgrades: Record<string, Record<string, number>>;
  dailies: Dailies;
  stats: PlayerStats;
}

export interface Garage {
  vehicle: string;
  character: string;
  hat: string;
  wheels: string;
  horn: string;
  dance: string;
  paint: string;
  favorites: string[];
}

export interface KeyBindings {
  up: string; down: string; left: string; right: string;
  drift: string; item: string; horn: string; pause: string;
}

export interface Settings {
  keys: KeyBindings;
  sensitivity: number;   // 0.5 .. 2
  touchScale: number;    // 0.8 .. 1.5
  swapTouch: boolean;
  tilt: boolean;
  units: "kmh" | "mph";
  music: boolean;
  sfx: boolean;
  quality: "low" | "high";
  shake: boolean;
}

export const DEFAULT_KEYS: KeyBindings = {
  up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD",
  drift: "Space", item: "KeyE", horn: "KeyH", pause: "Escape",
};

export const DEFAULT_GARAGE: Garage = {
  vehicle: "shopping-cart",
  character: "cappy",
  hat: "none",
  wheels: "classic",
  horn: "honk",
  dance: "wiggle",
  paint: "#e4572e",
  favorites: [],
};

export const DEFAULT_SETTINGS: Settings = {
  keys: { ...DEFAULT_KEYS },
  sensitivity: 1,
  touchScale: 1,
  swapTouch: false,
  tilt: false,
  units: "kmh",
  music: true,
  sfx: true,
  quality: "high",
  shake: true,
};

const LS_KEY = "wacky-racing-v1";

function localProfile(name: string): { profile: Profile; token: string } {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const profile: Profile = {
    id: "local-" + Math.random().toString(36).slice(2, 10),
    name,
    xp: 0,
    coins: 500,
    gems: 0,
    unlocked: {
      vehicles: ["shopping-cart", "chicken-bike"],
      characters: ["cappy"],
      hats: ["none"],
      wheels: ["classic"],
      horns: ["honk"],
      dances: ["wiggle"],
    },
    upgrades: {},
    dailies: { date: "", progress: {}, claimed: [] },
    stats: { races: 0, wins: 0, podiums: 0, coinsCollected: 0, powerupsUsed: 0, drifts: 0, eliminated: 0 },
  };
  return { profile, token };
}

function persistLocal(): void {
  if (typeof window === "undefined") return;
  try {
    const s = useApp.getState();
    window.localStorage.setItem(LS_KEY, JSON.stringify({
      settings: s.settings,
      garage: s.garage,
      profile: s.profile,
      token: s.token,
    }));
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// HUD store (read by components/game.tsx, written by the engine)
// ---------------------------------------------------------------------------

export interface FeedMsg { id: number; text: string; color?: string; }
export interface HudRacer { id: string; t: number; isPlayer: boolean; color: string; }

export interface HudState {
  speed: number;
  item: string | null;
  itemRolling: boolean;
  position: number;
  fieldSize: number;
  lap: number;
  lapsTotal: number;
  raceTimeMs: number;
  lapTimeMs: number;
  bestLapMs: number | null;
  countdown: number; // -1 = hidden
  chaosEvent: string | null;
  wrongWay: boolean;
  frozen: boolean;
  reversed: boolean;
  shielded: boolean;
  giant: boolean;
  offTrack: boolean;
  coins: number;
  feed: FeedMsg[];
  racers: HudRacer[];
  boosting: boolean;
  boostCharge: number;
}

export const useHud = create<HudState>(() => ({
  speed: 0,
  item: null,
  itemRolling: false,
  position: 1,
  fieldSize: 1,
  lap: 1,
  lapsTotal: 3,
  raceTimeMs: 0,
  lapTimeMs: 0,
  bestLapMs: null,
  countdown: -1,
  chaosEvent: null,
  wrongWay: false,
  frozen: false,
  reversed: false,
  shielded: false,
  giant: false,
  offTrack: false,
  coins: 0,
  feed: [],
  racers: [],
  boosting: false,
  boostCharge: 0,
}));

let feedId = 0;

export function pushFeed(text: string, color?: string): void {
  feedId += 1;
  const id = feedId;
  useHud.setState((s) => ({ feed: [...s.feed.slice(-4), { id, text, color }] }));
  setTimeout(() => {
    useHud.setState((s) => ({ feed: s.feed.filter((f) => f.id !== id) }));
  }, 4200);
}

// ---------------------------------------------------------------------------
// App store
// ---------------------------------------------------------------------------

interface AppState {
  screen: Screen;
  setScreen: (s: Screen) => void;
  inRace: boolean;
  setInRace: (b: boolean) => void;
  summary: RaceSummary | null;
  setSummary: (s: RaceSummary | null) => void;
  setup: RaceSetup;
  setSetup: (patch: Partial<RaceSetup>) => void;
  raceKey: number;
  bumpRaceKey: () => void;
  garage: Garage;
  patchGarage: (p: Partial<Garage>) => void;
  settings: Settings;
  patchSettings: (p: Partial<Settings>) => void;
  profile: Profile | null;
  token: string | null;
  hydrate: () => void;
  ensureProfile: (name: string) => Promise<void>;
  submitRace: (s: RaceSummary) => Promise<void>;
  apiPost: <T = Record<string, unknown>>(path: string, body: Record<string, unknown>) => Promise<T>;
  buyItem: (kind: keyof Unlocks, id: string, pay: "coins" | "gems") => Promise<{ ok: boolean; error?: string }>;
  openCrate: (crateId: string) => Promise<{ ok: boolean; reward?: { kind: string; id: string; name: string; rarity: Rarity }; coinsBack?: number; error?: string }>;
  buyUpgrade: (vehicleId: string, key: string) => Promise<{ ok: boolean; level?: number; cost?: number; error?: string }>;
  buyBundle: (bundleId: string, pay: "coins" | "gems") => Promise<{ ok: boolean; error?: string }>;
  exchangeGems: (packId: string) => Promise<{ ok: boolean; error?: string }>;
  toast: string | null;
  setToast: (t: string | null) => void;
}

const DEFAULT_SETUP: RaceSetup = { mode: "quick", track: "candy-rush", laps: 3, net: null };

export const useApp = create<AppState>((set, get) => ({
  screen: "menu",
  setScreen: (screen) => set({ screen }),
  inRace: false,
  setInRace: (inRace) => set({ inRace }),
  summary: null,
  setSummary: (summary) => set({ summary }),
  setup: { ...DEFAULT_SETUP },
  setSetup: (patch) => set((s) => ({ setup: { ...s.setup, ...patch } })),
  raceKey: 0,
  bumpRaceKey: () => set((s) => ({ raceKey: s.raceKey + 1 })),
  garage: { ...DEFAULT_GARAGE },
  patchGarage: (p) => set((s) => ({ garage: { ...s.garage, ...p } })),
  settings: { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_SETTINGS.keys } },
  patchSettings: (p) => set((s) => {
    const settings = { ...s.settings, ...p };
    if (p.keys) settings.keys = { ...s.settings.keys, ...p.keys };
    return { settings };
  }),
  profile: null,
  token: null,

  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<{ settings: Settings; garage: Garage; profile: Profile; token: string }>;
      set((s) => ({
        settings: saved.settings ? { ...DEFAULT_SETTINGS, ...saved.settings, keys: { ...DEFAULT_SETTINGS.keys, ...saved.settings.keys } } : s.settings,
        garage: saved.garage ? { ...DEFAULT_GARAGE, ...saved.garage } : s.garage,
        profile: saved.profile ?? null,
        token: saved.token ?? null,
      }));
    } catch { /* ignore */ }
  },

  ensureProfile: async (name: string) => {
    const clean = name.replace(/[^\w \-!?.]/g, "").trim().slice(0, 16) || "Racer";
    // try server first
    try {
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: clean }),
      });
      if (r.ok) {
        const j = await r.json();
        if (j.profile && j.token) {
          set({ profile: j.profile as Profile, token: j.token as string });
          persistLocal();
          return;
        }
      }
    } catch { /* offline -> local profile */ }
    const { profile, token } = localProfile(clean);
    set({ profile, token });
    persistLocal();
  },

  apiPost: async <T,>(path: string, body: Record<string, unknown>): Promise<T> => {
    const { profile, token } = get();
    if (!profile || !token) throw new Error("no_profile");
    const r = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: profile.id, token, ...body }),
    });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
    if (!r.ok) throw new Error(j.error ?? `http_${r.status}`);
    if (j.profile) {
      set({ profile: j.profile as Profile });
      persistLocal();
    }
    return j as T;
  },

  submitRace: async (s) => {
    const { profile, token } = get();
    let xpEarned = 0, coinsEarned = 0, gemsEarned = 0;

    if (profile && token) {
      try {
        const j = await get().apiPost<Record<string, number | Profile>>("/api/race/result", {
          trackId: s.track,
          vehicleId: s.vehicleId,
          mode: MODES.some((m) => m.id === s.mode) ? s.mode : "quick",
          position: s.position,
          fieldSize: s.fieldSize,
          totalMs: Math.round(s.totalMs),
          bestLapMs: s.bestLapMs,
          coinsCollected: s.coinsCollected,
        });
        xpEarned = Number(j.xpEarned ?? 0);
        coinsEarned = Number(j.coinsEarned ?? 0);
        gemsEarned = Number(j.gemsEarned ?? 0);
      } catch {
        // offline fallback — mirror the server formula locally
        const posScore = Math.max(0, s.fieldSize - s.position + 1);
        xpEarned = 20 + posScore * 12 + (s.position === 1 ? 25 : 0) + (s.bestLapMs ? 5 : 0);
        const goldenBonus = s.vehicleId === "golden-chariot" ? 1.15 : 1;
        coinsEarned = Math.round((10 + posScore * 8 + (s.position === 1 ? 40 : 0) + s.coinsCollected * 2) * goldenBonus);
        const competitive = s.fieldSize > 1 && s.mode !== "practice";
        gemsEarned = competitive ? (s.position === 1 ? 3 : s.position === 2 ? 2 : s.position === 3 ? 1 : 0) : 0;
        set((st) => st.profile ? {
          profile: {
            ...st.profile,
            xp: st.profile.xp + xpEarned,
            coins: st.profile.coins + coinsEarned,
            gems: st.profile.gems + gemsEarned,
            stats: {
              ...st.profile.stats,
              races: st.profile.stats.races + 1,
              wins: st.profile.stats.wins + (s.position === 1 ? 1 : 0),
              podiums: st.profile.stats.podiums + (s.position <= 3 ? 1 : 0),
              coinsCollected: st.profile.stats.coinsCollected + s.coinsCollected,
              powerupsUsed: st.profile.stats.powerupsUsed + (s.powerupsUsed ?? 0),
              drifts: st.profile.stats.drifts + (s.drifts ?? 0),
            },
          },
        } : {});
        persistLocal();
      }
      // stats + dailies progress sync (best effort)
      try {
        await get().apiPost("/api/sync", {
          stats: {
            races: 1,
            wins: s.position === 1 ? 1 : 0,
            podiums: s.position <= 3 ? 1 : 0,
            coinsCollected: s.coinsCollected,
            powerupsUsed: s.powerupsUsed ?? 0,
            drifts: s.drifts ?? 0,
            eliminated: 0,
          },
          dailies: {
            progress: {
              win_race: s.position === 1 ? 1 : 0,
              collect_coins: s.coinsCollected,
              drift_time: s.drifts ?? 0,
              use_powerups: s.powerupsUsed ?? 0,
              finish_races: 1,
            },
          },
        });
      } catch { /* offline */ }
    }

    set({ summary: { ...s, xpEarned, coinsEarned, gemsEarned } });
  },

  buyItem: async (kind, id, pay) => {
    // server first
    try {
      await get().apiPost("/api/shop/buy", { kind, id, pay });
      return { ok: true };
    } catch (e) {
      if ((e as Error).message !== "no_profile") {
        // could be a real server rejection (insufficient, already_owned...) — surface it
        const msg = (e as Error).message;
        if (msg !== "no_profile" && !msg.startsWith("http_5")) {
          // fetch itself failed (offline) OR server 4xx; distinguish: 4xx means DB is up
          if (!msg.includes("Failed to fetch") && !msg.includes("NetworkError") && msg !== "fetch_failed") {
            // server responded with an error code like insufficient / already_owned
            if (["insufficient", "already_owned", "unknown_item", "not_gem_purchasable", "auth", "bad_request"].includes(msg)) return { ok: false, error: msg };
          }
        }
      }
    }
    // offline local purchase
    const { profile } = get();
    if (!profile) return { ok: false, error: "no_profile" };
    if (profile.unlocked[kind].includes(id)) return { ok: false, error: "already_owned" };
    const price = priceOf(kind, id);
    if (!price) return { ok: false, error: "unknown_item" };
    if (pay === "gems") {
      if (price.gems === undefined) return { ok: false, error: "not_gem_purchasable" };
      if (profile.gems < price.gems) return { ok: false, error: "insufficient" };
      const unlocked = { ...profile.unlocked, [kind]: [...profile.unlocked[kind], id] };
      set({ profile: { ...profile, gems: profile.gems - price.gems, unlocked } });
    } else {
      if (profile.coins < price.coins) return { ok: false, error: "insufficient" };
      const unlocked = { ...profile.unlocked, [kind]: [...profile.unlocked[kind], id] };
      set({ profile: { ...profile, coins: profile.coins - price.coins, unlocked } });
    }
    persistLocal();
    return { ok: true };
  },

  openCrate: async (crateId) => {
    const crate = CRATES.find((c) => c.id === crateId);
    if (!crate) return { ok: false, error: "unknown_crate" };
    try {
      const j = await get().apiPost<{ reward: { kind: string; id: string; name: string; rarity: Rarity } | null; coinsBack: number }>("/api/shop/crate", { crate: crateId });
      return { ok: true, reward: j.reward ?? undefined, coinsBack: j.coinsBack };
    } catch { /* offline below */ }
    const { profile } = get();
    if (!profile) return { ok: false, error: "no_profile" };
    if (crate.currency === "gems") { if (profile.gems < crate.price) return { ok: false, error: "insufficient" }; }
    else if (profile.coins < crate.price) return { ok: false, error: "insufficient" };
    // local roll (same rules as the server route)
    const tiers: Rarity[] = ["legendary", "epic", "rare", "common"];
    const total = Object.values(crate.odds).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let rolled: Rarity = "common";
    for (const key of tiers) { r -= crate.odds[key]; if (r <= 0) { rolled = key; break; } }
    const order = [rolled, ...tiers.filter((t) => t !== rolled)];
    let reward: { kind: string; id: string; name: string; rarity: Rarity } | null = null;
    for (const tier of order) {
      const pool = VEHICLES.filter((v) => v.rarity === tier && v.price > 0 && !profile.unlocked.vehicles.includes(v.id));
      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        reward = { kind: "vehicles", id: pick.id, name: pick.name, rarity: pick.rarity };
        break;
      }
    }
    let coinsBack = 0;
    let unlocked = profile.unlocked;
    if (reward) {
      unlocked = { ...profile.unlocked, vehicles: [...profile.unlocked.vehicles, reward.id] };
    } else {
      coinsBack = Math.round(crate.price * (crate.currency === "gems" ? 40 : 1.15));
    }
    set({
      profile: {
        ...profile,
        coins: profile.coins - (crate.currency === "coins" ? crate.price : 0) + coinsBack,
        gems: profile.gems - (crate.currency === "gems" ? crate.price : 0),
        unlocked,
      },
    });
    persistLocal();
    return { ok: true, reward: reward ?? undefined, coinsBack };
  },

  buyUpgrade: async (vehicleId, key) => {
    const veh = vehicleById(vehicleId);
    const { profile } = get();
    if (!profile) return { ok: false, error: "no_profile" };
    if (!profile.unlocked.vehicles.includes(vehicleId)) return { ok: false, error: "not_owned" };
    const forCar = profile.upgrades[vehicleId] ?? {};
    const current = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Math.floor(forCar[key] ?? 0)));
    if (current >= MAX_UPGRADE_LEVEL) return { ok: false, error: "maxed" };
    const next = current + 1;
    const cost = upgradeCost(veh, key as "engine", next);
    if (profile.coins < cost) return { ok: false, error: "insufficient" };
    try {
      const j = await get().apiPost<{ level: number; cost: number }>("/api/shop/upgrade", { vehicleId, key });
      return { ok: true, level: j.level, cost: j.cost };
    } catch { /* offline below */ }
    const upgrades = { ...profile.upgrades, [vehicleId]: { ...forCar, [key]: next } };
    set({ profile: { ...profile, coins: profile.coins - cost, upgrades } });
    persistLocal();
    return { ok: true, level: next, cost };
  },

  buyBundle: async (bundleId, pay) => {
    const bundle = BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) return { ok: false, error: "unknown_bundle" };
    try {
      await get().apiPost("/api/shop/buy", { bundle: bundleId, pay });
      return { ok: true };
    } catch { /* offline below */ }
    const { profile } = get();
    if (!profile) return { ok: false, error: "no_profile" };
    const useGems = pay === "gems" && typeof bundle.gems === "number";
    const cost = useGems ? bundle.gems ?? 0 : bundle.coins;
    if (useGems ? profile.gems < cost : profile.coins < cost) return { ok: false, error: "insufficient" };
    const unlocked: Unlocks = { vehicles: [...profile.unlocked.vehicles], characters: [...profile.unlocked.characters], hats: [...profile.unlocked.hats], wheels: [...profile.unlocked.wheels], horns: [...profile.unlocked.horns], dances: [...profile.unlocked.dances] };
    for (const item of bundle.items) {
      if (!unlocked[item.kind].includes(item.id)) unlocked[item.kind].push(item.id);
    }
    set({
      profile: {
        ...profile,
        coins: profile.coins - (useGems ? 0 : bundle.coins) + (bundle.bonusCoins ?? 0),
        gems: profile.gems - (useGems ? cost : 0),
        unlocked,
      },
    });
    persistLocal();
    return { ok: true };
  },

  exchangeGems: async (packId) => {
    const pack = GEM_EXCHANGE.find((g) => g.id === packId);
    if (!pack) return { ok: false, error: "unknown_pack" };
    try {
      await get().apiPost("/api/shop/buy", { gemPack: packId });
      return { ok: true };
    } catch { /* offline below */ }
    const { profile } = get();
    if (!profile) return { ok: false, error: "no_profile" };
    if (profile.coins < pack.coins) return { ok: false, error: "insufficient" };
    set({ profile: { ...profile, coins: profile.coins - pack.coins, gems: profile.gems + pack.gems } });
    persistLocal();
    return { ok: true };
  },

  toast: null,
  setToast: (toast) => set({ toast }),
}));

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function priceOf(kind: keyof Unlocks, id: string): { coins: number; gems?: number } | null {
  switch (kind) {
    case "vehicles": { const v = VEHICLES.find((x) => x.id === id); return v ? { coins: v.price, gems: v.gems } : null; }
    case "characters": { const c = CHARACTERS.find((x) => x.id === id); return c ? { coins: c.price } : null; }
    case "hats": { const h = HATS.find((x) => x.id === id); return h ? { coins: h.price } : null; }
    case "wheels": { const w = WHEELS.find((x) => x.id === id); return w ? { coins: w.price } : null; }
    case "horns": { const h = HORNS.find((x) => x.id === id); return h ? { coins: h.price } : null; }
    case "dances": { const d = DANCES.find((x) => x.id === id); return d ? { coins: d.price } : null; }
    default: return null;
  }
}

export { MODES, modeById, levelFromXp, UPGRADES, MAX_UPGRADE_LEVEL, upgradeCost };
