// Load the starter menu + tables into Supabase (safe to re-run: upserts by id).
// Usage: npm run seed   (reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local)
import { createClient } from "@supabase/supabase-js";
import { seedCategories, seedDecor, seedMenuItems, seedTables } from "../src/lib/seed";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

for (const [table, rows] of [
  ["menu_categories", seedCategories],
  ["menu_items", seedMenuItems],
  ["tables", seedTables],
  ["floor_decor", seedDecor],
] as const) {
  const { error } = await sb.from(table).upsert(rows as never, { onConflict: "id", ignoreDuplicates: true });
  if (error) {
    console.error(table, error.message);
    process.exit(1);
  }
  console.log(`✓ ${table}: ${rows.length}`);
}
