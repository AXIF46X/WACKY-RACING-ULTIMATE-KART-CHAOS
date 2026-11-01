import { db } from "@/db";
import { players, raceResults, bestLaps } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

import { TRACKS as TRACK_DEFS, VEHICLES as VEHICLE_DEFS, MODES as MODE_DEFS } from "@/game/data";

const TRACKS = TRACK_DEFS.map((t) => t.id);
const VEHICLES = VEHICLE_DEFS.map((v) => v.id);
const MODES = MODE_DEFS.map((m) => m.id);
const MIN_LAP_MS = 9000; // absolute floor: faster laps are rejected (anti-cheat)

// POST: submit a finished race. Server computes ALL rewards — never trusts client xp/coins.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { playerId, token } = body ?? {};
    const trackId = String(body?.trackId ?? "");
    const vehicleId = String(body?.vehicleId ?? "");
    const mode = String(body?.mode ?? "quick");
    const position = clamp(body?.position, 1, 20, 8);
    const fieldSize = clamp(body?.fieldSize, 1, 20, 6);
    const totalMs = clamp(body?.totalMs, 5000, 3600000, 60000);
    const bestLapRaw = typeof body?.bestLapMs === "number" ? Math.floor(body.bestLapMs) : null;
    const coinsCollected = clamp(body?.coinsCollected, 0, 60, 0);

    if (!TRACKS.includes(trackId) || !VEHICLES.includes(vehicleId) || !MODES.includes(mode))
      return Response.json({ error: "bad_request" }, { status: 400 });
    if (typeof playerId !== "string" || typeof token !== "string")
      return Response.json({ error: "bad_request" }, { status: 400 });

    const [p] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (!p || p.token !== token) return Response.json({ error: "auth" }, { status: 401 });

    const bestLapMs = bestLapRaw && bestLapRaw >= MIN_LAP_MS ? bestLapRaw : null;

    // Server-side reward formula.
    const posScore = Math.max(0, fieldSize - position + 1);
    const xpEarned = 20 + posScore * 12 + (position === 1 ? 25 : 0) + (bestLapMs ? 5 : 0);
    const goldenBonus = vehicleId === "golden-chariot" ? 1.15 : 1; // Champion's Aura perk
    const coinsEarned = Math.round((10 + posScore * 8 + (position === 1 ? 40 : 0) + coinsCollected * 2) * goldenBonus);
    // Gems: a small premium drip for strong finishes in real races.
    const competitive = fieldSize > 1 && mode !== "practice";
    const gemsEarned = competitive ? (position === 1 ? 3 : position === 2 ? 2 : position === 3 ? 1 : 0) : 0;

    await db.insert(raceResults).values({
      playerId: p.id, mode, trackId, vehicleId, position, fieldSize, totalMs, bestLapMs, xpEarned, coinsEarned,
    });
    if (bestLapMs) {
      await db.insert(bestLaps).values({
        playerId: p.id, playerName: p.name, trackId, vehicleId, lapMs: bestLapMs,
      });
    }
    const [updated] = await db
      .update(players)
      .set({ xp: p.xp + xpEarned, coins: p.coins + coinsEarned, gems: p.gems + gemsEarned })
      .where(eq(players.id, p.id))
      .returning();
    return Response.json({ xpEarned, coinsEarned, gemsEarned, profile: updated });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "result_failed" }, { status: 500 });
  }
}

function clamp(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : dflt;
  return Math.max(min, Math.min(max, n));
}
