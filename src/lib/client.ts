"use client";

import useSWR, { type SWRConfiguration } from "swr";
import type { Liff } from "@line/liff";

// Browser-side helpers: LINE identity (real LIFF or a demo user) + API calls.

export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "";
export const lineMode = Boolean(LIFF_ID);

let liffPromise: Promise<Liff> | null = null;

/** Initialise LIFF once; logs the user in when opened outside the LINE app. */
export function getLiff(): Promise<Liff> {
  liffPromise ??= (async () => {
    const { default: liff } = await import("@line/liff");
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href });
      await new Promise(() => {}); // page is navigating away
    }
    return liff;
  })();
  return liffPromise;
}

export interface DemoUser {
  userId: string;
  displayName: string;
  pictureUrl: string | null;
}

export const DEMO_USERS: DemoUser[] = [
  { userId: "demo-u1", displayName: "พี่มิ้นท์", pictureUrl: null },
  { userId: "demo-u2", displayName: "น้องต้นข้าว", pictureUrl: null },
  { userId: "demo-u3", displayName: "ลุงเปา", pictureUrl: null },
];

const DEMO_KEY = "ouleng:demo-user";

export function getDemoUser(): DemoUser {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEMO_USERS[0];
}

export function setDemoUser(u: DemoUser) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(u));
  } catch {}
}

async function authHeaders(): Promise<Record<string, string>> {
  if (lineMode) {
    const liff = await getLiff();
    const token = liff.getIDToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  return { "x-demo-user": encodeURIComponent(JSON.stringify(getDemoUser())) };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(action: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`/api/${action}`, {
    method: "POST",
    headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), ...(await authHeaders()) },
    body: isForm ? body : JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "เกิดข้อผิดพลาด", res.status);
  return data as T;
}

/** SWR wrapper; pass `null` as action to skip fetching. */
export function useApi<T>(action: string | null, body?: unknown, config?: SWRConfiguration<T>) {
  return useSWR<T>(action ? [action, JSON.stringify(body ?? {})] : null, () => api<T>(action!, body), config);
}

/** Close the LIFF window (or go home in a normal browser). */
export async function closeOrHome(home = "/liff") {
  if (lineMode) {
    const liff = await getLiff();
    if (liff.isInClient()) return liff.closeWindow();
  }
  window.location.href = home;
}
