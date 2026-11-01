import { getDb } from "@/db";
import { players, type PlayerStats, type Unlocks } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

import { VEHICLES, CHARACTERS, HATS, WHEELS, HORNS, DANCES } from "@/game/data";

// Catalog is the single source of truth, shared with the client.
const KNOWN: Record<keyof Unlocks, string[]> = {
  vehicles: VEHICLES.map((v) => v.id),
  characters: CHARACTERS.map((c) => c.id),
  hats: HATS.map((h) => h.id),
  wheels: WHEELS.map((w) => w.id),
  horns: HORNS.map((h) => h.id),
  dances: DANCES.map((d) => d.id),
};

const priceMap = <T extends { id: string; price: number }>(arr: readonly T[]) =>
  Object.fromEntries(arr.map((x) => [x.id, x.price]));

const PRICES: Record<string, Record<string, number>> = {
  vehicles: priceMap(VEHICLES),
  characters: priceMap(CHARACTERS),
  hats: priceMap(HATS),
  wheels: priceMap(WHEELS),
  horns: priceMap(HORNS),
  dances: priceMap(DANCES),
};

function uniqValid(kind: keyof typeof KNOWN, arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const v of arr) if (typeof v === "string" && KNOWN[kind].includes(v) && !out.includes(v)) out.push(v);
  return out;
}

// POST { playerId, token, unlocks } -> validates purchases against wallet server-side.
export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const { playerId, token } = body ?? {};
    if (typeof playerId !== "string" || typeof token !== "string")
      return Response.json({ error: "bad_request" }, { status: 400 });
    const [p] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (!p || p.token !== token) return Response.json({ error: "auth" }, { status: 401 });

    const reqUnlocks = body.unlocks as Partial<Unlocks> | undefined;
    let unlocked: Unlocks = { ...p.unlocked };
    let coins = p.coins;

    if (reqUnlocks) {
      // Compute owned set with prices validated on the server.
      for (const kind of Object.keys(KNOWN) as (keyof typeof KNOWN)[]) {
        const want = uniqValid(kind, reqUnlocks[kind]);
        const priceTable = PRICES[kind] ?? {};
        for (const item of want) {
          if (unlocked[kind].includes(item)) continue;
          const price = priceTable[item] ?? 0;
          if (coins >= price) {
            coins -= price;
            unlocked[kind].push(item);
          }
        }
      }
    }

    // Dailies claim: server pays fixed rewards only.
    const dailies = body.dailies as { date?: string; progress?: Record<string, number>; claim?: string } | undefined;
    let dailyData = p.dailies ?? { date: "", progress: {}, claimed: [] as string[] };
    const DAILY_REWARDS: Record<string, number> = { win_race: 120, collect_coins: 60, drift_time: 80, use_powerups: 80, finish_races: 60 };
    const today = new Date().toISOString().slice(0, 10);
    if (dailies) {
      if (dailyData.date !== today) dailyData = { date: today, progress: {}, claimed: [] };
      const progress: Record<string, number> = dailyData.progress ?? {};
      if (dailies.progress && typeof dailies.progress === "object") {
        for (const [k, v] of Object.entries(dailies.progress)) {
          if (typeof v === "number" && v >= 0) progress[k] = Math.min(9999, Math.max(progress[k] ?? 0, Math.floor(v)));
        }
      }
      const claimed = dailyData.claimed ?? [];
      if (dailies.claim && DAILY_REWARDS[dailies.claim] && !claimed.includes(dailies.claim)) {
        claimed.push(dailies.claim);
        coins += DAILY_REWARDS[dailies.claim];
      }
      dailyData = { date: today, progress, claimed };
    }

    const stats = { ...p.stats } as PlayerStats;
    if (body.stats && typeof body.stats === "object") {
      const s = body.stats as Partial<PlayerStats>;
      stats.races = Math.min(100000, stats.races + clampInt(s.races, 1));
      stats.wins = Math.min(stats.races, stats.wins + clampInt(s.wins, 1));
      stats.podiums = Math.min(stats.races, stats.podiums + clampInt(s.podiums, 1));
      stats.coinsCollected = Math.min(10_000_000, stats.coinsCollected + clampInt(s.coinsCollected, 60));
      stats.powerupsUsed = Math.min(1_000_000, stats.powerupsUsed + clampInt(s.powerupsUsed, 40));
      stats.drifts = Math.min(1_000_000, stats.drifts + clampInt(s.drifts, 100));
      stats.eliminated = Math.min(1_000_000, stats.eliminated + clampInt(s.eliminated, 10));
    }

    const [updated] = await db
      .update(players)
      .set({ coins, unlocked, dailies: dailyData, stats })
      .where(eq(players.id, p.id))
      .returning();
    return Response.json({ profile: updated });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "sync_failed" }, { status: 500 });
  }
}

function clampInt(v: unknown, max: number): number {
  const n = typeof v === "number" ? Math.floor(v) : 0;
  if (n < 0 || !Number.isFinite(n)) return 0;
  return Math.min(n, max);
}
