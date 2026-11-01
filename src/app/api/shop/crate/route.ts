import { getDb } from "@/db";
import { players, type Unlocks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CRATES, VEHICLES, HATS, WHEELS, HORNS, DANCES, type Rarity } from "@/game/data";

export const dynamic = "force-dynamic";

/** Cosmetic fallbacks by rarity tier, used when every car of a tier is owned. */
const COSMETIC_POOL: { kind: keyof Unlocks; id: string; rarity: Rarity }[] = [
  ...HATS.filter((h) => h.price > 0).map((h) => ({
    kind: "hats" as keyof Unlocks, id: h.id, rarity: (h.price >= 350 ? "epic" : h.price >= 200 ? "rare" : "common") as Rarity,
  })),
  ...WHEELS.filter((w) => w.price > 0).map((w) => ({ kind: "wheels" as keyof Unlocks, id: w.id, rarity: "rare" as Rarity })),
  ...HORNS.filter((h) => h.price > 0).map((h) => ({ kind: "horns" as keyof Unlocks, id: h.id, rarity: "common" as Rarity })),
  ...DANCES.filter((d) => d.price > 0).map((d) => ({ kind: "dances" as keyof Unlocks, id: d.id, rarity: "rare" as Rarity })),
];

function rollRarity(odds: Record<Rarity, number>): Rarity {
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const key of Object.keys(odds) as Rarity[]) {
    r -= odds[key];
    if (r <= 0) return key;
  }
  return "common";
}

// POST { playerId, token, crate }
export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const { playerId, token } = body ?? {};
    if (typeof playerId !== "string" || typeof token !== "string")
      return Response.json({ error: "bad_request" }, { status: 400 });

    const crate = CRATES.find((c) => c.id === String(body.crate ?? ""));
    if (!crate) return Response.json({ error: "unknown_crate" }, { status: 400 });

    const [p] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (!p || p.token !== token) return Response.json({ error: "auth" }, { status: 401 });

    let coins = p.coins;
    let gems = p.gems;
    if (crate.currency === "gems") {
      if (gems < crate.price) return Response.json({ error: "insufficient" }, { status: 402 });
      gems -= crate.price;
    } else {
      if (coins < crate.price) return Response.json({ error: "insufficient" }, { status: 402 });
      coins -= crate.price;
    }

    const unlocked: Unlocks = {
      vehicles: [...p.unlocked.vehicles], characters: [...p.unlocked.characters],
      hats: [...p.unlocked.hats], wheels: [...p.unlocked.wheels],
      horns: [...p.unlocked.horns], dances: [...p.unlocked.dances],
    };

    // Roll a rarity, then pick an unowned car in that tier (walking tiers if needed).
    const tiers: Rarity[] = ["legendary", "epic", "rare", "common"];
    const rolled = rollRarity(crate.odds);
    const searchOrder = [rolled, ...tiers.filter((t) => t !== rolled)];

    let reward: { kind: keyof Unlocks; id: string; name: string; rarity: Rarity } | null = null;
    for (const tier of searchOrder) {
      // only drop tiers the crate can actually produce, on the first pass
      if (crate.odds[tier] === 0 && tier !== rolled && reward === null && tier !== searchOrder[searchOrder.length - 1]) {
        const stillPossible = searchOrder.some((t) => crate.odds[t] > 0 && !allOwned(t, unlocked.vehicles));
        if (stillPossible) continue;
      }
      const pool = VEHICLES.filter((v) => v.rarity === tier && v.price > 0 && !unlocked.vehicles.includes(v.id));
      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        reward = { kind: "vehicles", id: pick.id, name: pick.name, rarity: pick.rarity };
        break;
      }
    }

    // Every car owned in all tiers? Hand out a cosmetic, else coins.
    let coinsBack = 0;
    if (!reward) {
      const cosmetics = COSMETIC_POOL.filter((c) => !unlocked[c.kind].includes(c.id));
      if (cosmetics.length > 0) {
        const pick = cosmetics[Math.floor(Math.random() * cosmetics.length)];
        reward = { kind: pick.kind, id: pick.id, name: pick.id.replace(/-/g, " "), rarity: pick.rarity };
      } else {
        coinsBack = Math.round(crate.price * (crate.currency === "gems" ? 40 : 1.15));
        coins += coinsBack;
      }
    }
    if (reward) unlocked[reward.kind].push(reward.id);

    const [updated] = await db
      .update(players)
      .set({ coins, gems, unlocked })
      .where(eq(players.id, p.id))
      .returning();

    return Response.json({ profile: updated, reward, coinsBack });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "crate_failed" }, { status: 500 });
  }
}

function allOwned(tier: Rarity, owned: string[]): boolean {
  return VEHICLES.filter((v) => v.rarity === tier && v.price > 0).every((v) => owned.includes(v.id));
}
