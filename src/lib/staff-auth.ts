import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type Role = "somtam" | "cafe" | "cashier" | "admin";

export const ROLE_LABEL: Record<Role, string> = {
  somtam: "ครัวส้มตำ",
  cafe: "เคาน์เตอร์คาเฟ่",
  cashier: "แคชเชียร์",
  admin: "แอดมิน",
};

// Demo PINs only apply when the env vars are unset; set real ones in production.
const PINS: Record<Role, string> = {
  somtam: process.env.STAFF_PIN_SOMTAM ?? "1111",
  cafe: process.env.STAFF_PIN_CAFE ?? "2222",
  cashier: process.env.STAFF_PIN_CASHIER ?? "3333",
  admin: process.env.STAFF_PIN_ADMIN ?? "9999",
};

const SECRET = process.env.STAFF_SESSION_SECRET ?? "demo-secret-change-me";

// Demo defaults are public knowledge; refuse to run a real deployment with them.
if (process.env.NODE_ENV === "production" && process.env.SUPABASE_URL) {
  const missing = ["STAFF_SESSION_SECRET", "STAFF_PIN_SOMTAM", "STAFF_PIN_CAFE", "STAFF_PIN_CASHIER", "STAFF_PIN_ADMIN"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) throw new Error(`Set ${missing.join(", ")} before deploying (see .env.example)`);
}
export const STAFF_COOKIE = "ouleng_staff";
const MAX_AGE_S = 60 * 60 * 16;

export function roleForPin(pin: string): Role | null {
  return (Object.keys(PINS) as Role[]).find((r) => PINS[r] === pin) ?? null;
}

const sign = (payload: string) => createHmac("sha256", SECRET).update(payload).digest("base64url");

export function makeToken(role: Role): string {
  const payload = `${role}.${Date.now() + MAX_AGE_S * 1000}`;
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | undefined): Role | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  const payload = token.slice(0, i);
  const sig = Buffer.from(token.slice(i + 1));
  const want = Buffer.from(sign(payload));
  if (sig.length !== want.length || !timingSafeEqual(sig, want)) return null;
  const [role, exp] = payload.split(".");
  if (Number(exp) < Date.now() || !(role in PINS)) return null;
  return role as Role;
}

export const cookieMaxAge = MAX_AGE_S;

/**
 * Short key printed in each table's QR so nobody can order to a table
 * just by guessing its code from outside the shop.
 */
export const tableKey = (code: string) =>
  createHmac("sha256", SECRET).update(`table:${code}`).digest("base64url").slice(0, 8);

