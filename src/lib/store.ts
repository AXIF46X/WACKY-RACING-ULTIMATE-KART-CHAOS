"use client";

import { create } from "zustand";
import type { PlayerStats, Unlocks } from "@/db/schema";
import { STARTER_STATS, STARTER_UNLOCKS } from "@/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Profile {
  id: string;
  name: string;
  xp: number;
  coins: number;
  gems: number;
  unlocked: Unlocks;
  upgrades: Record<string, Record<string, number>>;
  stats: PlayerStats;
  dailies: { date: string; progress: Record<string, number>; claimed: string[] } | null;
}

export interface CrateReward {
  kind: keyof Unlocks;
  id: string;
  name: string;
  rarity: string;
  coinsBack?: number;
}

export type Screen =
  | "menu" | "modes" | "tracks" | "garage" | "characters" | "shop"
  | "events" | "ranks" | "friends" | "settings" | "howto";

export interface GarageSel {
  vehicle: string;
  character: string;
  paint: string;
  hat: string;
  wheels: string;
  horn: string;
  dance: string;
}

export interface KeyBindings {
  accel: string;
  brake: string;
  left: string;
  right: string;
  drift: string;
  item: string;
  horn: string;
}

export const DEFAULT_KEYS: KeyBindings = {
  accel: "KeyW",
  brake: "KeyS",
  left: "KeyA",
  right: "KeyD",
  drift: "Space",
  item: "KeyE",
  horn: "KeyH",
};

export interface Settings {
  music: boolean;
  sfx: boolean;
  quality: "auto" | "high" | "low";
  shake: boolean;
  units: "kmh" | "mph";
  /** Remappable keyboard bindings (KeyCodes; arrows always work as secondaries) */
  keys: KeyBindings;
  /** 0.5 = mellow / 1 = default / 2 = twitchy */
  sensitivity: number;
  /** touch button scale 0.8–1.5 */
  touchScale: number;
  /** pedal cluster on the left, steering on the right */
  swapTouch: boolean;
  /** steer with the device gyro (mobile) */
  tilt: boolean;
}

export interface RaceSetup {
  mode: string;
  track: string;
  gpRace?: number; // grand prix race index
  gpScores?: Record<string, number>;
  gpOrder?: string[];
  net?: NetRoomInfo | null;
}

export type P2PMessage = { t: string } & Record<string, unknown>;

export interface P2PRoomLike {
  send: (m: P2PMessage) => void;
  sendTo: (id: string, m: P2PMessage) => void;
  onMessage: (cb: (from: string, m: P2PMessage) => void) => () => void;
  onPeerLeft: (cb: (id: string) => void) => () => void;
  onOpen?: (cb: (id: string) => void) => () => void;
  close: () => void;
  peers: { id: string; name: string; vehicle: string; character: string; paint: string }[];
}

export interface NetRoomInfo {
  isHost: boolean;
  roomId: string;
  peers: { id: string; name: string; vehicle: string; character: string; paint: string }[];
  selfPeerId: string;
  selfIsGuest: boolean;
  bots?: { name: string; vehicle: string; character: string; paint: string }[];
  room: P2PRoomLike; // P2PRoom
}

export interface RaceSummary {
  mode: string;
  trackId: string;
  trackName: string;
  vehicleId: string;
  position: number;
  fieldSize: number;
  totalMs: number;
  bestLapMs: number | null;
  coinsCollected: number;
  powerupsUsed: number;
  driftMs: number;
  standings: { name: string; position: number; isPlayer: boolean; isBot: boolean; team?: number; totalMs?: number }[];
  teamScores?: [number, number];
  xpEarned?: number;
  coinsEarned?: number;
  gemsEarned?: number;
  gpScores?: Record<string, number>;
  gpNames?: Record<string, string>;
  gpDone?: boolean;
  eliminated?: boolean;
  win?: boolean;
}

// ---------------------------------------------------------------------------
// Local guest save helpers
// ---------------------------------------------------------------------------
const SAVE_KEY = "wacky-racing-save-v1";

interface LocalSave {
  profile: Profile | null;
  token: string | null;
  garage: GarageSel;
  settings: Settings;
  achievementsClaimed: string[];
  seenHowTo: boolean;
  favorites: string[];
}

function loadSave(): LocalSave {
  const dflt: LocalSave = {
    profile: null,
    token: null,
    garage: { vehicle: "shopping-cart", character: "captain-noodle", paint: "#e4572e", hat: "none", wheels: "classic", horn: "party", dance: "spin" },
    settings: {
      music: true, sfx: true, quality: "auto", shake: true, units: "kmh",
      keys: DEFAULT_KEYS, sensitivity: 1, touchScale: 1, swapTouch: false, tilt: false,
    },
    achievementsClaimed: [],
    seenHowTo: false,
    favorites: [],
  };
  if (typeof window === "undefined") return dflt;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return dflt;
    const p = JSON.parse(raw) as Partial<LocalSave>;
    return {
      profile: p.profile ? { ...p.profile, unlocked: { ...STARTER_UNLOCKS, ...p.profile.unlocked }, stats: { ...STARTER_STATS, ...p.profile.stats } } : null,
      token: typeof p.token === "string" ? p.token : null,
      garage: { ...dflt.garage, ...p.garage },
      settings: { ...dflt.settings, ...p.settings, keys: { ...DEFAULT_KEYS, ...(p.settings?.keys ?? {}) } },
      achievementsClaimed: Array.isArray(p.achievementsClaimed) ? p.achievementsClaimed : [],
      seenHowTo: !!p.seenHowTo,
      favorites: Array.isArray(p.favorites) ? p.favorites : [],
    };
  } catch {
    return dflt;
  }
}

/** Merge-persist: callers only pass what changed, the rest is preserved. */
function persist(patch: Partial<LocalSave>) {
  if (typeof window === "undefined") return;
  try {
    const prev = localStorage.getItem(SAVE_KEY);
    const base = prev ? (JSON.parse(prev) as Partial<LocalSave>) : {};
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...base, ...patch }));
  } catch { /* storage full/blocked */ }
}

// ---------------------------------------------------------------------------
// App store
// ---------------------------------------------------------------------------
interface AppState extends LocalSave {
  screen: Screen;
  prevScreen: Screen;
  setup: RaceSetup;
  summary: RaceSummary | null;
  inRace: boolean;
  paused: boolean;
  online: boolean;

  setScreen: (s: Screen) => void;
  setGarage: (g: Partial<GarageSel>) => void;
  setSettings: (s: Partial<Settings>) => void;
  setSetup: (s: Partial<RaceSetup>) => void;
  login: (name: string) => Promise<string | null>;
  logout: () => void;
  refreshProfile: (p: Profile) => void;
  purchase: (kind: keyof Unlocks, id: string, price: number) => Promise<boolean>;
  buyItem: (kind: keyof Unlocks, id: string, pay?: "coins" | "gems") => Promise<{ ok: boolean; error?: string }>;
  buyBundle: (bundleId: string, pay?: "coins" | "gems") => Promise<{ ok: boolean; error?: string; granted?: number }>;
  buyGems: (packId: string) => Promise<{ ok: boolean; error?: string }>;
  openCrate: (crateId: string) => Promise<{ ok: boolean; error?: string; reward?: CrateReward | null; coinsBack?: number }>;
  buyUpgrade: (vehicleId: string, key: string) => Promise<{ ok: boolean; error?: string; level?: number; cost?: number }>;
  toggleFavorite: (vehId: string) => void;
  submitRace: (r: RaceSummary) => Promise<void>;
  claimDaily: (id: string, reward: number) => Promise<void>;
  claimAchievement: (id: string, reward: number) => void;
  bumpDaily: (id: string, amount: number) => void;
  setInRace: (b: boolean) => void;
  setPaused: (b: boolean) => void;
  setSummary: (s: RaceSummary | null) => void;
  markHowTo: () => void;
  resetGuest: () => void;
  raceKey: number;
  bumpRaceKey: () => void;
}

export const useApp = create<AppState>((set, get) => {
  const save = loadSave();
  return {
    ...save,
    screen: "menu",
    prevScreen: "menu",
    setup: { mode: "quick", track: "candy-rush" },
    summary: null,
    inRace: false,
    paused: false,
    online: true,
    raceKey: 0,
    bumpRaceKey: () => set((st) => ({ raceKey: st.raceKey + 1 })),

    setScreen: (s) => set((st) => ({ screen: s, prevScreen: st.screen })),

    setGarage: (g) => set((st) => {
      const garage = { ...st.garage, ...g };
      persist({ profile: st.profile, token: st.token, garage, settings: st.settings, achievementsClaimed: st.achievementsClaimed, seenHowTo: st.seenHowTo });
      return { garage };
    }),

    setSettings: (s) => set((st) => {
      const settings = { ...st.settings, ...s };
      persist({ profile: st.profile, token: st.token, garage: st.garage, settings, achievementsClaimed: st.achievementsClaimed, seenHowTo: st.seenHowTo });
      return { settings };
    }),

    setSetup: (s) => set((st) => ({ setup: { ...st.setup, ...s } })),

    login: async (name) => {
      try {
        const res = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (!res.ok || !data.profile) return "Could not reach the profile server. Playing as guest!";
        const profile: Profile = { ...data.profile };
        set((st) => {
          persist({ profile, token: data.token, garage: st.garage, settings: st.settings, achievementsClaimed: st.achievementsClaimed, seenHowTo: st.seenHowTo });
          return { profile, token: data.token };
        });
        return data.isNew ? null : `Welcome back, ${profile.name}!`;
      } catch {
        return "Offline? Playing as guest.";
      }
    },

    logout: () => set((st) => {
      persist({ profile: null, token: null, garage: st.garage, settings: st.settings, achievementsClaimed: st.achievementsClaimed, seenHowTo: st.seenHowTo });
      return { profile: null, token: null };
    }),

    refreshProfile: (p) => set((st) => {
      persist({ profile: p, token: st.token, garage: st.garage, settings: st.settings, achievementsClaimed: st.achievementsClaimed, seenHowTo: st.seenHowTo });
      return { profile: p };
    }),

    purchase: async (kind, id, price) => {
      const st = get();
      if (!st.profile) return false;
      if (st.profile.coins < price) return false;
      if (st.profile.unlocked[kind].includes(id)) return true;
      const optimistic: Profile = {
        ...st.profile,
        coins: st.profile.coins - price,
        unlocked: { ...st.profile.unlocked, [kind]: [...st.profile.unlocked[kind], id] },
      };
      st.refreshProfile(optimistic);
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: st.profile.id, token: st.token, unlocks: optimistic.unlocked }),
        });
        const data = await res.json();
        if (res.ok && data.profile) get().refreshProfile({ ...data.profile });
      } catch { /* keep optimistic */ }
      return true;
    },

    buyItem: async (kind, id, pay = "coins") => {
      const st = get();
      if (!st.profile || !st.token) return { ok: false, error: "Sign in to buy things!" };
      try {
        const res = await fetch("/api/shop/buy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: st.profile.id, token: st.token, kind, id, pay }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error === "insufficient" ? (pay === "gems" ? "Not enough gems!" : "Not enough coins!") : "Purchase failed." };
        }
        get().refreshProfile({ ...data.profile });
        return { ok: true };
      } catch {
        return { ok: false, error: "Network hiccup — try again." };
      }
    },

    buyBundle: async (bundleId, pay = "coins") => {
      const st = get();
      if (!st.profile || !st.token) return { ok: false, error: "Sign in to buy bundles!" };
      try {
        const res = await fetch("/api/shop/buy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: st.profile.id, token: st.token, bundle: bundleId, pay }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error === "insufficient" ? "Not enough funds!" : "Purchase failed." };
        get().refreshProfile({ ...data.profile });
        return { ok: true, granted: (data.granted ?? []).length };
      } catch {
        return { ok: false, error: "Network hiccup — try again." };
      }
    },

    buyGems: async (packId) => {
      const st = get();
      if (!st.profile || !st.token) return { ok: false, error: "Sign in first!" };
      try {
        const res = await fetch("/api/shop/buy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: st.profile.id, token: st.token, gemPack: packId }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error === "insufficient" ? "Not enough coins!" : "Exchange failed." };
        get().refreshProfile({ ...data.profile });
        return { ok: true };
      } catch {
        return { ok: false, error: "Network hiccup — try again." };
      }
    },

    openCrate: async (crateId) => {
      const st = get();
      if (!st.profile || !st.token) return { ok: false, error: "Sign in to open crates!" };
      try {
        const res = await fetch("/api/shop/crate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: st.profile.id, token: st.token, crate: crateId }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error === "insufficient" ? "Not enough funds for that crate!" : "Crate jammed — try again." };
        get().refreshProfile({ ...data.profile });
        return { ok: true, reward: data.reward ?? null, coinsBack: data.coinsBack ?? 0 };
      } catch {
        return { ok: false, error: "Network hiccup — try again." };
      }
    },

    buyUpgrade: async (vehicleId, key) => {
      const st = get();
      if (!st.profile || !st.token) return { ok: false, error: "Sign in to tune your cars!" };
      try {
        const res = await fetch("/api/shop/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: st.profile.id, token: st.token, vehicleId, key }),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg = data.error === "insufficient" ? "Not enough coins!"
            : data.error === "maxed" ? "Already maxed out!"
            : data.error === "not_owned" ? "Buy the car first!"
            : "Upgrade failed.";
          return { ok: false, error: msg };
        }
        get().refreshProfile({ ...data.profile });
        return { ok: true, level: data.level, cost: data.cost };
      } catch {
        return { ok: false, error: "Network hiccup — try again." };
      }
    },

    toggleFavorite: (vehId) => set((st) => {
      const favorites = st.favorites.includes(vehId)
        ? st.favorites.filter((f) => f !== vehId)
        : [...st.favorites, vehId];
      persist({ favorites });
      return { favorites };
    }),

    submitRace: async (r) => {
      const st = get();
      const prof = st.profile;
      // Stat bumps always tracked locally.
      const stats: PlayerStats = prof ? { ...prof.stats } : { ...STARTER_STATS };
      stats.races += 1;
      if (r.position === 1) stats.wins += 1;
      if (r.position <= 3) stats.podiums += 1;
      stats.coinsCollected += r.coinsCollected;
      stats.powerupsUsed += r.powerupsUsed;
      stats.drifts += Math.floor(r.driftMs / 1000);
      // Daily progress
      const today = new Date().toISOString().slice(0, 10);
      const dailies = prof?.dailies && prof.dailies.date === today
        ? { ...prof.dailies, progress: { ...prof.dailies.progress } }
        : { date: today, progress: {} as Record<string, number>, claimed: [] as string[] };
      dailies.progress.finish_races = (dailies.progress.finish_races ?? 0) + 1;
      dailies.progress.collect_coins = (dailies.progress.collect_coins ?? 0) + r.coinsCollected;
      dailies.progress.use_powerups = (dailies.progress.use_powerups ?? 0) + r.powerupsUsed;
      dailies.progress.drift_time = (dailies.progress.drift_time ?? 0) + Math.floor(r.driftMs / 1000);
      if (r.position === 1) dailies.progress.win_race = (dailies.progress.win_race ?? 0) + 1;

      if (prof) {
        // Optimistic local numbers; server returns the true awards.
        set({ profile: { ...prof, stats, dailies } });
        try {
          const res = await fetch("/api/race/result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playerId: prof.id, token: st.token, mode: r.mode, trackId: r.trackId, vehicleId: r.vehicleId,
              position: r.position, fieldSize: r.fieldSize, totalMs: Math.floor(r.totalMs),
              bestLapMs: r.bestLapMs ? Math.floor(r.bestLapMs) : null, coinsCollected: r.coinsCollected,
            }),
          });
          const data = await res.json();
          if (res.ok && data.profile) {
            const merged: Profile = { ...data.profile, stats, dailies };
            get().refreshProfile(merged);
            get().setSummary({ ...r, xpEarned: data.xpEarned, coinsEarned: data.coinsEarned, gemsEarned: data.gemsEarned });
            void fetch("/api/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playerId: prof.id, token: st.token, stats: { races: 1, wins: r.position === 1 ? 1 : 0, podiums: r.position <= 3 ? 1 : 0, coinsCollected: r.coinsCollected, powerupsUsed: r.powerupsUsed, drifts: Math.floor(r.driftMs / 1000), eliminated: r.eliminated ? 1 : 0 }, dailies: { date: today, progress: dailies.progress } }),
            }).catch(() => undefined);
            return;
          }
        } catch { /* offline: local-only */ }
        get().refreshProfile({ ...prof, stats, dailies });
      }
      get().setSummary({ ...r });
    },

    claimDaily: async (id, reward) => {
      const st = get();
      if (!st.profile || !st.profile.dailies) return;
      if (st.profile.dailies.claimed.includes(id)) return;
      const dailies = { ...st.profile.dailies, claimed: [...st.profile.dailies.claimed, id] };
      st.refreshProfile({ ...st.profile, coins: st.profile.coins + reward, dailies });
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: st.profile.id, token: st.token, dailies: { date: dailies.date, progress: dailies.progress, claim: id } }),
        });
        const data = await res.json();
        if (res.ok && data.profile) get().refreshProfile({ ...data.profile });
      } catch { /* optimistic */ }
    },

    claimAchievement: (id, reward) => set((st) => {
      if (st.achievementsClaimed.includes(id)) return {};
      const achievementsClaimed = [...st.achievementsClaimed, id];
      const profile = st.profile ? { ...st.profile, coins: st.profile.coins + reward } : null;
      persist({ profile, token: st.token, garage: st.garage, settings: st.settings, achievementsClaimed, seenHowTo: st.seenHowTo });
      return { achievementsClaimed, profile };
    }),

    bumpDaily: (id, amount) => set((st) => {
      if (!st.profile) return {};
      const today = new Date().toISOString().slice(0, 10);
      const dailies = st.profile.dailies && st.profile.dailies.date === today
        ? { ...st.profile.dailies, progress: { ...st.profile.dailies.progress } }
        : { date: today, progress: {}, claimed: [] };
      dailies.progress[id] = (dailies.progress[id] ?? 0) + amount;
      const profile = { ...st.profile, dailies };
      return { profile };
    }),

    setInRace: (b) => set({ inRace: b }),
    setPaused: (b) => set({ paused: b }),
    setSummary: (s) => set({ summary: s }),
    markHowTo: () => set((st) => {
      persist({ profile: st.profile, token: st.token, garage: st.garage, settings: st.settings, achievementsClaimed: st.achievementsClaimed, seenHowTo: true });
      return { seenHowTo: true };
    }),
    resetGuest: () => set((st) => {
      const garage = { vehicle: "shopping-cart", character: "captain-noodle", paint: "#e4572e", hat: "none", wheels: "classic", horn: "party", dance: "spin" };
      persist({ profile: null, token: null, garage, settings: st.settings, achievementsClaimed: [], seenHowTo: st.seenHowTo });
      return { profile: null, token: null, garage, achievementsClaimed: [] };
    }),
  };
});

// ---------------------------------------------------------------------------
// HUD store — high-frequency updates pushed by the engine
// ---------------------------------------------------------------------------
export interface HudRacer { id: string; name: string; t: number; lap: number; isPlayer: boolean; isBot: boolean; color: string; finished: boolean; eliminated?: boolean; }
export interface FeedMsg { id: number; text: string; color?: string; }

interface HudState {
  speed: number; // units/s
  boostCharge: number; // 0..1 while drifting
  boosting: boolean;
  item: string | null;
  itemRolling: boolean;
  lap: number;
  lapsTotal: number;
  lapTimeMs: number;
  raceTimeMs: number;
  bestLapMs: number | null;
  position: number;
  fieldSize: number;
  countdown: number; // 3..1, 0 = GO, -1 = racing
  racers: HudRacer[];
  feed: FeedMsg[];
  coins: number;
  frozen: boolean;
  reversed: boolean;
  shielded: boolean;
  giant: boolean;
  offTrack: boolean;
  wrongWay: boolean;
  finished: boolean;
  chaosEvent: string | null;

  set: (p: Partial<HudState>) => void;
  pushFeed: (text: string, color?: string) => void;
}

let feedId = 0;

export const useHud = create<HudState>((set) => ({
  speed: 0, boostCharge: 0, boosting: false, item: null, itemRolling: false,
  lap: 1, lapsTotal: 3, lapTimeMs: 0, raceTimeMs: 0, bestLapMs: null,
  position: 1, fieldSize: 6, countdown: 3, racers: [], feed: [], coins: 0,
  frozen: false, reversed: false, shielded: false, giant: false,
  offTrack: false, wrongWay: false, finished: false, chaosEvent: null,

  set: (p) => set(p),
  pushFeed: (text, color) => set((st) => {
    const feed = [...st.feed, { id: ++feedId, text, color }].slice(-5);
    return { feed };
  }),
}));
