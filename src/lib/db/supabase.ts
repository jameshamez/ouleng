import { createClient } from "@supabase/supabase-js";
import type { Db } from "./index";

const BUCKET = "uploads";

export function createSupabaseDb(): Db {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const fail = (e: { message: string } | null) => {
    if (e) throw new Error(e.message);
  };

  return {
    async list(table, filter = {}) {
      // PostgREST rejects `in.()`; an empty IN list simply matches nothing.
      if (Object.values(filter).some((v) => Array.isArray(v) && v.length === 0)) return [];
      let q = sb.from(table).select("*");
      for (const [k, v] of Object.entries(filter)) {
        q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v as never);
      }
      const { data, error } = await q;
      fail(error);
      return data ?? [];
    },
    async get(table, id) {
      const { data, error } = await sb.from(table).select("*").eq("id", id).maybeSingle();
      fail(error);
      return data;
    },
    async insert(table, row) {
      const { data, error } = await sb.from(table).insert(row as never).select().single();
      fail(error);
      return data as never;
    },
    async update(table, id, patch) {
      const { data, error } = await sb.from(table).update(patch as never).eq("id", id).select().single();
      fail(error);
      return data as never;
    },
    async remove(table, id) {
      const { error } = await sb.from(table).delete().eq("id", id);
      fail(error);
    },
    async upload(name, bytes, contentType) {
      const { error } = await sb.storage.from(BUCKET).upload(name, bytes, { contentType });
      fail(error);
      return name;
    },
    async fileUrl(ref) {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(ref, 600);
      fail(error);
      return data!.signedUrl;
    },
  };
}
