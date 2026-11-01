import { getDb } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { VEHICLES, UPGRADES, MAX_UPGRADE_LEVEL, upgradeCost, type UpgradeKey } from "@/game/data";

export const dynamic = "force-dynamic";

const VALID_KEYS = UPGRADES.map((u) => u.key) as string[];

// POST { playerId, token, vehicleId, key }
// Buys exactly ONE level. Cost + level cap are computed server-side.
export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const { playerId, token } = body ?? {};
    const vehicleId = String(body?.vehicleId ?? "");
    const key = String(body?.key ?? "") as UpgradeKey;

    if (typeof playerId !== "string" || typeof token !== "string")
      return Response.json({ error: "bad_request" }, { status: 400 });
    const veh = VEHICLES.find((v) => v.id === vehicleId);
    if (!veh || !VALID_KEYS.includes(key))
      return Response.json({ error: "unknown_upgrade" }, { status: 400 });

    const [p] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (!p || p.token !== token) return Response.json({ error: "auth" }, { status: 401 });

    // must own the car before tuning it
    if (!p.unlocked.vehicles.includes(vehicleId))
      return Response.json({ error: "not_owned" }, { status: 403 });

    const all: Record<string, Record<string, number>> = { ...(p.upgrades ?? {}) };
    const forCar: Record<string, number> = { ...(all[vehicleId] ?? {}) };
    const current = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Math.floor(forCar[key] ?? 0)));
    if (current >= MAX_UPGRADE_LEVEL)
      return Response.json({ error: "maxed" }, { status: 409 });

    const next = current + 1;
    const cost = upgradeCost(veh, key, next);
    if (p.coins < cost) return Response.json({ error: "insufficient" }, { status: 402 });

    forCar[key] = next;
    all[vehicleId] = forCar;

    const [updated] = await db
      .update(players)
      .set({ coins: p.coins - cost, upgrades: all })
      .where(eq(players.id, p.id))
      .returning();

    return Response.json({ profile: updated, level: next, cost });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "upgrade_failed" }, { status: 500 });
  }
}
