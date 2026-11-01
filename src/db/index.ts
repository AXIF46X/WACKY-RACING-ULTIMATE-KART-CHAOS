import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// The pool connects lazily — importing this module without a reachable
// DATABASE_URL is fine; only actual queries fail (API routes catch that).
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

export const pool = new Pool({ connectionString, max: 5 });

export const db = drizzle(pool, { schema });
