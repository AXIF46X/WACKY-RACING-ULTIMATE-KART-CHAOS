import { db } from "@/db";
import { bestLaps, players } from "@/db/schema";
import { desc, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET ?track=candy-rush  -> top 20 best laps on a track
// GET ?top=players       -> top 20 racers by XP
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("top") === "players") {
      const rows = await db
        .select({ name: players.name, xp: players.xp, stats: players.stats })
        .from(players)
        .orderBy(desc(players.xp))
        .limit(20);
      return Response.json({ players: rows });
    }
    const track = url.searchParams.get("track") ?? "candy-rush";
    const laps = await db
      .select()
      .from(bestLaps)
      .orderBy(asc(bestLaps.lapMs))
      .limit(400);
    // Take best lap per player on this track.
    const best = new Map<string, { name: string; vehicle: string; lapMs: number; when: string }>();
    for (const l of laps) {
      if (l.trackId !== track) continue;
      if (!best.has(l.playerId)) {
        best.set(l.playerId, {
          name: l.playerName,
          vehicle: l.vehicleId,
          lapMs: l.lapMs,
          when: l.createdAt.toISOString(),
        });
      }
      if (best.size >= 20) break;
    }
    return Response.json({ laps: [...best.values()] });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "leaderboard_failed" }, { status: 500 });
  }
}
