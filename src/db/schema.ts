import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export type Unlocks = {
  vehicles: string[];
  characters: string[];
  hats: string[];
  wheels: string[];
  horns: string[];
  dances: string[];
};

export type PlayerStats = {
  races: number;
  wins: number;
  podiums: number;
  coinsCollected: number;
  powerupsUsed: number;
  drifts: number;
  eliminated: number;
};

export const STARTER_UNLOCKS: Unlocks = {
  vehicles: ["shopping-cart", "pizza-scooter", "chicken-bike"],
  characters: ["captain-noodle", "granny-turbo"],
  hats: ["none"],
  wheels: ["classic"],
  horns: ["party"],
  dances: ["spin"],
};

export const STARTER_STATS: PlayerStats = {
  races: 0,
  wins: 0,
  podiums: 0,
  coinsCollected: 0,
  powerupsUsed: 0,
  drifts: 0,
  eliminated: 0,
};

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    token: uuid("token").notNull().defaultRandom(),
    xp: integer("xp").notNull().default(0),
    coins: integer("coins").notNull().default(300),
    gems: integer("gems").notNull().default(15),
    unlocked: jsonb("unlocked").$type<Unlocks>().notNull().default(STARTER_UNLOCKS),
    upgrades: jsonb("upgrades").$type<Record<string, Record<string, number>>>().notNull().default({}),
    stats: jsonb("stats").$type<PlayerStats>().notNull().default(STARTER_STATS),
    dailies: jsonb("dailies").$type<{ date: string; progress: Record<string, number>; claimed: string[] }>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("players_xp_idx").on(t.xp)],
);

export const raceResults = pgTable(
  "race_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id").notNull(),
    mode: text("mode").notNull(),
    trackId: text("track_id").notNull(),
    vehicleId: text("vehicle_id").notNull(),
    position: integer("position").notNull(),
    fieldSize: integer("field_size").notNull(),
    totalMs: integer("total_ms").notNull(),
    bestLapMs: integer("best_lap_ms"),
    xpEarned: integer("xp_earned").notNull(),
    coinsEarned: integer("coins_earned").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("race_results_player_idx").on(t.playerId)],
);

export const bestLaps = pgTable(
  "best_laps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id").notNull(),
    playerName: text("player_name").notNull(),
    trackId: text("track_id").notNull(),
    vehicleId: text("vehicle_id").notNull(),
    lapMs: integer("lap_ms").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("best_laps_track_idx").on(t.trackId, t.lapMs)],
);
