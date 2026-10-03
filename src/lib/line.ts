import "server-only";
import { HttpError } from "./errors";

// LINE Messaging API + LIFF ID-token verification. Without credentials every
// message is logged instead of sent, so the app runs end-to-end in demo mode.

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const STAFF_GROUP = process.env.LINE_STAFF_GROUP_ID;
const LOGIN_CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID;

export const lineLive = Boolean(process.env.NEXT_PUBLIC_LIFF_ID && LOGIN_CHANNEL_ID);

async function push(to: string, text: string) {
  if (!TOKEN || to.startsWith("demo-")) {
    console.log(`[LINE → ${to}] ${text}`);
    return;
  }
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) console.error("LINE push failed", res.status, await res.text());
}

/** Fire-and-forget: a LINE outage must never fail an order. */
export function notifyCustomer(lineUserId: string, text: string) {
  push(lineUserId, text).catch((e) => console.error("LINE push error", e));
}

export function notifyStaff(text: string) {
  push(STAFF_GROUP ?? "demo-staff-group", text).catch((e) => console.error("LINE push error", e));
}

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl: string | null;
}

/** Verify a LIFF ID token with LINE and return who it belongs to. */
export async function verifyIdToken(idToken: string): Promise<LineProfile> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: LOGIN_CHANNEL_ID! }),
  });
  if (!res.ok) throw new HttpError(401, "LINE login หมดอายุ กรุณาเปิดใหม่จาก LINE");
  const p = (await res.json()) as { sub: string; name?: string; picture?: string };
  return { userId: p.sub, displayName: p.name ?? "ลูกค้า", pictureUrl: p.picture ?? null };
}
