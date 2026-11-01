import { getDb } from "@/db";
import { players, type Unlocks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { VEHICLES, CHARACTERS, HATS, WHEELS, HORNS, DANCES, BUNDLES, GEM_EXCHANGE } from "@/game/data";

export const dynamic = "force-dynamic";

type Kind = keyof Unlocks;

/** Server-side source of truth for every price. Clients never set prices. */
function catalogPrice(kind: Kind, id: string): { coins: number; gems?: number } | null {
  const find = <T extends { id: string; price: number }>(arr: readonly T[]) => arr.find((x) => x.id === id);
  switch (kind) {
    case "vehicles": {
      const v = find(VEHICLES);
      return v ? { coins: v.price, gems: v.gems } : null;
    }
    case "characters": {
      const c = find(CHARACTERS);
      return c ? { coins: c.price } : null;
    }
    case "hats": {
      const h = find(HATS);
      return h ? { coins: h.price } : null;
    }
    case "wheels": {
      const w = find(WHEELS);
      return w ? { coins: w.price } : null;
    }
    case "horns": {
      const h = find(HORNS);
      return h ? { coins: h.price } : null;
    }
    case "dances": {
      const d = find(DANCES);
      return d ? { coins: d.price } : null;
    }
    default:
      return null;
  }
}

// POST { playerId, token, kind, id, pay?: "coins"|"gems" }
//      { playerId, token, bundle: "<id>", pay }
//      { playerId, token, gemPack: "<id>" }
export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const { playerId, token } = body ?? {};
    if (typeof playerId !== "string" || typeof token !== "string")
      return Response.json({ error: "bad_request" }, { status: 400 });

    const [p] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (!p || p.token !== token) return Response.json({ error: "auth" }, { status: 401 });

    let coins = p.coins;
    let gems = p.gems;
    const unlocked: Unlocks = {
      vehicles: [...p.unlocked.vehicles], characters: [...p.unlocked.characters],
      hats: [...p.unlocked.hats], wheels: [...p.unlocked.wheels],
      horns: [...p.unlocked.horns], dances: [...p.unlocked.dances],
    };
    const pay: "coins" | "gems" = body.pay === "gems" ? "gems" : "coins";

    // ---- gem exchange (coins -> gems) ----
    if (typeof body.gemPack === "string") {
      const pack = GEM_EXCHANGE.find((g) => g.id === body.gemPack);
      if (!pack) return Response.json({ error: "unknown_pack" }, { status: 400 });
      if (coins < pack.coins) return Response.json({ error: "insufficient" }, { status: 402 });
      coins -= pack.coins;
      gems += pack.gems;
      const [u1] = await db.update(players).set({ coins, gems }).where(eq(players.id, p.id)).returning();
      return Response.json({ profile: u1, granted: [] });
    }

    // ---- bundles ----
    if (typeof body.bundle === "string") {
      const bundle = BUNDLES.find((b) => b.id === body.bundle);
      if (!bundle) return Response.json({ error: "unknown_bundle" }, { status: 400 });
      const useGems = pay === "gems" && typeof bundle.gems === "number";
      if (useGems) {
        if (gems < (bundle.gems ?? 0)) return Response.json({ error: "insufficient" }, { status: 402 });
        gems -= bundle.gems ?? 0;
      } else {
        if (coins < bundle.coins) return Response.json({ error: "insufficient" }, { status: 402 });
        coins -= bundle.coins;
      }
      const granted: { kind: Kind; id: string }[] = [];
      for (const item of bundle.items) {
        const k = item.kind as Kind;
        if (!unlocked[k].includes(item.id)) {
          unlocked[k].push(item.id);
          granted.push({ kind: k, id: item.id });
        }
      }
      if (bundle.bonusCoins) coins += bundle.bonusCoins;
      const [u2] = await db.update(players).set({ coins, gems, unlocked }).where(eq(players.id, p.id)).returning();
      return Response.json({ profile: u2, granted });
    }

    // ---- single item ----
    const kind = String(body.kind ?? "") as Kind;
    const id = String(body.id ?? "");
    const price = catalogPrice(kind, id);
    if (!price) return Response.json({ error: "unknown_item" }, { status: 400 });
    if (unlocked[kind].includes(id)) return Response.json({ error: "already_owned" }, { status: 409 });

    if (pay === "gems") {
      if (price.gems === undefined) return Response.json({ error: "not_gem_purchasable" }, { status: 400 });
      if (gems < price.gems) return Response.json({ error: "insufficient" }, { status: 402 });
      gems -= price.gems;
    } else {
      if (coins < price.coins) return Response.json({ error: "insufficient" }, { status: 402 });
      coins -= price.coins;
    }
    unlocked[kind].push(id);

    const [updated] = await db
      .update(players)
      .set({ coins, gems, unlocked })
      .where(eq(players.id, p.id))
      .returning();
    return Response.json({ profile: updated, granted: [{ kind, id }] });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "buy_failed" }, { status: 500 });
  }
}
