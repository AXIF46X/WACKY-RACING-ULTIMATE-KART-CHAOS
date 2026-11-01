import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

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
  date: string; // YYYY-MM-DD
  progress: Record<string, number>;
  claimed: string[];
}

export const STARTER_UNLOCKS: Unlocks = {
  vehicles: ["shopping-cart", "chicken-bike"],
  characters: ["cappy"],
  hats: ["none"],
  wheels: ["classic"],
  horns: ["honk"],
  dances: ["wiggle"],
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

export const STARTER_DAILIES: Dailies = { date: "", progress: {}, claimed: [] };

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  token: text("token").notNull().$defaultFn(() => randomUUID()),
  xp: integer("xp").notNull().default(0),
  coins: integer("coins").notNull().default(500),
  gems: integer("gems").notNull().default(0),
  unlocked: jsonb("unlocked").$type<Unlocks>().notNull().$defaultFn(() => STARTER_UNLOCKS),
  upgrades: jsonb("upgrades").$type<Record<string, Record<string, number>>>().notNull().$defaultFn(() => ({})),
  dailies: jsonb("dailies").$type<Dailies>().notNull().$defaultFn(() => STARTER_DAILIES),
  stats: jsonb("stats").$type<PlayerStats>().notNull().$defaultFn(() => STARTER_STATS),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;

export const raceResults = pgTable("race_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(),
  trackId: text("track_id").notNull(),
  vehicleId: text("vehicle_id").notNull(),
  position: integer("position").notNull(),
  fieldSize: integer("field_size").notNull(),
  totalMs: integer("total_ms").notNull(),
  bestLapMs: integer("best_lap_ms"),
  xpEarned: integer("xp_earned").notNull(),
  coinsEarned: integer("coins_earned").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bestLaps = pgTable("best_laps", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  playerName: text("player_name").notNull(),
  trackId: text("track_id").notNull(),
  vehicleId: text("vehicle_id").notNull(),
  lapMs: integer("lap_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
