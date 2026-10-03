import fs from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { UPLOAD_DIR } from "@/lib/db/demo";
import { readToken, STAFF_COOKIE } from "@/lib/staff-auth";

// Demo-mode file server for payment slips (Supabase mode uses signed URLs instead).
export async function GET(req: NextRequest, ctx: RouteContext<"/api/file/[name]">) {
  if (!readToken(req.cookies.get(STAFF_COOKIE)?.value)) return new Response("Unauthorized", { status: 401 });
  const name = path.basename((await ctx.params).name);
  try {
    const bytes = await fs.readFile(path.join(UPLOAD_DIR, name));
    const ext = path.extname(name).slice(1);
    return new Response(bytes, { headers: { "Content-Type": `image/${ext === "jpg" ? "jpeg" : ext}` } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
