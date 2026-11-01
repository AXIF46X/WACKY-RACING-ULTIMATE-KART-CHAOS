import { db } from "@/db";
import { players, STARTER_UNLOCKS, STARTER_STATS } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function sanitizeName(raw: unknown): string {
  const s = String(raw ?? "")
    .replace(/[^\w \-!?.]/g, "")
    .trim()
    .slice(0, 16);
  return s || "Racer";
}

// POST: create-or-load a racer profile by name. Returns profile + secret token.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = sanitizeName(body?.name);
    const existing = await db.select().from(players).where(eq(players.name, name)).limit(1);
    if (existing.length > 0) {
      const p = existing[0];
      return Response.json({ profile: p, token: p.token, isNew: false });
    }
    const [p] = await db
      .insert(players)
      .values({ name, unlocked: STARTER_UNLOCKS, stats: STARTER_STATS })
      .returning();
    return Response.json({ profile: p, token: p.token, isNew: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "profile_failed" }, { status: 500 });
  }
}
