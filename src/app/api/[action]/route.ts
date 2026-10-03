import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSupabase } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { lineLive, verifyIdToken, type LineProfile } from "@/lib/line";
import * as svc from "@/lib/service";
import { cookieMaxAge, makeToken, readToken, roleForPin, ROLE_LABEL, STAFF_COOKIE, type Role } from "@/lib/staff-auth";

// Single RPC-style endpoint: POST /api/<action> with a JSON body
// (or multipart for payment slips). Each action declares who may call it.

type Who = "public" | "customer" | Role[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untrusted JSON; each service function validates its own fields
type Ctx = { body: Record<string, any>; form: FormData | null; customer: LineProfile | null; role: Role | null };

const KITCHEN: Role[] = ["somtam", "cafe", "cashier", "admin"];
const FRONT: Role[] = ["cashier", "admin"];

const actions: Record<string, { who: Who; run: (c: Ctx) => Promise<unknown> }> = {
  // --- customer (LIFF) ---
  menu: { who: "public", run: () => svc.getMenu() },
  me: {
    who: "customer",
    run: async ({ customer }) => {
      await svc.upsertCustomer(customer!);
      return { profile: customer, ...(await svc.myActivity(customer!.userId)) };
    },
  },
  availability: {
    who: "public",
    run: ({ body }) => svc.availability({ date: body.date, partySize: Number(body.partySize), zone: body.zone }),
  },
  createBooking: { who: "customer", run: ({ body, customer }) => svc.createBooking(customer!.userId, body as never) },
  cancelBooking: { who: "customer", run: ({ body, customer }) => svc.cancelMyBooking(customer!.userId, body.id) },
  joinTable: { who: "public", run: ({ body }) => svc.joinTable(String(body.tableCode), String(body.key)) },
  session: { who: "public", run: ({ body }) => svc.sessionView(String(body.sessionId)) },
  pickupSlots: { who: "public", run: async () => svc.pickupSlots() },
  placeOrder: {
    who: "customer",
    run: ({ body, customer }) => svc.placeOrder(customer!.userId, customer!.displayName, body as never),
  },
  requestBill: { who: "public", run: ({ body }) => svc.requestBill(String(body.sessionId)) },
  order: { who: "customer", run: ({ body, customer }) => svc.orderView(customer!.userId, String(body.orderId)) },
  payInfo: { who: "public", run: ({ body }) => svc.payInfo(body.targetType, String(body.targetId)) },
  submitPayment: {
    who: "public",
    run: ({ form }) => {
      if (!form) throw new HttpError(400, "ต้องส่งเป็น multipart/form-data");
      return svc.submitPayment({
        targetType: form.get("targetType") as never,
        targetId: String(form.get("targetId")),
        method: form.get("method") as never,
        slip: form.get("slip") as File | null,
      });
    },
  },

  // --- staff ---
  staffMe: { who: [...KITCHEN], run: async ({ role }) => ({ role, label: ROLE_LABEL[role!] }) },
  kitchen: {
    who: KITCHEN,
    run: ({ role, body }) => svc.kitchenBoard(stationFor(role!, body.station)),
  },
  setItemStatus: {
    who: KITCHEN,
    run: ({ role, body }) => svc.setItemStatus(String(body.itemId), body.status, stationFor(role!, "all")),
  },
  setAvailability: {
    who: KITCHEN,
    run: ({ body }) => svc.setMenuAvailability(String(body.id), Boolean(body.isAvailable)),
  },
  cashier: { who: FRONT, run: () => svc.cashierBoard() },
  verifyPayment: { who: FRONT, run: ({ body }) => svc.verifyPayment(String(body.paymentId), Boolean(body.approve)) },
  settleCash: { who: FRONT, run: ({ body }) => svc.settleCash(String(body.sessionId)) },
  openTable: { who: FRONT, run: ({ body }) => svc.staffOpenTable(String(body.tableId)) },
  staffSession: { who: FRONT, run: ({ body }) => svc.sessionView(String(body.sessionId)) },
  pickupOrder: { who: FRONT, run: ({ body }) => svc.pickupOrder(String(body.orderId)) },
  bookings: { who: FRONT, run: ({ body }) => svc.bookingsForDate(String(body.date)) },
  setBookingStatus: { who: FRONT, run: ({ body }) => svc.setBookingStatus(String(body.id), body.status) },
  seatBooking: { who: FRONT, run: ({ body }) => svc.seatBooking(String(body.id), String(body.tableId)) },
  sales: { who: ["admin"], run: () => svc.salesToday() },
  tableQrs: { who: FRONT, run: () => svc.tableQrs() },
  updateMenuItem: { who: ["admin"], run: ({ body }) => svc.updateMenuItem(String(body.id), body.patch ?? {}) },
};

/** Kitchen roles only ever see their own station; front-of-house can pick. */
function stationFor(role: Role, requested: unknown) {
  if (role === "somtam" || role === "cafe") return role;
  return requested === "somtam" || requested === "cafe" ? requested : "all";
}

const tokenCache = new Map<string, { p: LineProfile; exp: number }>();

async function resolveCustomer(req: NextRequest): Promise<LineProfile> {
  if (!lineLive) {
    if (isSupabase && process.env.NODE_ENV === "production")
      throw new HttpError(503, "ร้านยังไม่ได้ตั้งค่า LINE Login");
    // Demo mode: the browser picks a fake LINE user (see src/lib/liff-client.ts).
    const raw = req.headers.get("x-demo-user");
    try {
      const p = JSON.parse(decodeURIComponent(raw ?? ""));
      if (typeof p.userId === "string" && p.userId.startsWith("demo-")) return p;
    } catch {}
    return { userId: "demo-guest", displayName: "ลูกค้าทดลอง", pictureUrl: null };
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new HttpError(401, "กรุณาเปิดผ่าน LINE");
  const hit = tokenCache.get(token);
  if (hit && hit.exp > Date.now()) return hit.p;
  const p = await verifyIdToken(token);
  tokenCache.set(token, { p, exp: Date.now() + 5 * 60_000 });
  return p;
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/[action]">) {
  const { action } = await ctx.params;
  try {
    if (action === "staffLogin") return staffLogin(req);
    if (action === "staffLogout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(STAFF_COOKIE);
      return res;
    }

    const def = actions[action];
    if (!def) throw new HttpError(404, "ไม่พบคำสั่ง");

    const isForm = req.headers.get("content-type")?.startsWith("multipart/form-data");
    const form = isForm ? await req.formData() : null;
    const body = isForm ? {} : await req.json().catch(() => ({}));
    const c: Ctx = { body, form, customer: null, role: null };

    if (def.who === "customer") c.customer = await resolveCustomer(req);
    if (Array.isArray(def.who)) {
      c.role = readToken(req.cookies.get(STAFF_COOKIE)?.value);
      if (!c.role) throw new HttpError(401, "กรุณาเข้าสู่ระบบพนักงาน");
      if (!def.who.includes(c.role)) throw new HttpError(403, "สิทธิ์ไม่พอสำหรับหน้านี้");
    }
    return NextResponse.json((await def.run(c)) ?? { ok: true });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(`[api/${action}]`, e);
    return NextResponse.json({ error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

async function staffLogin(req: NextRequest) {
  const { pin } = await req.json().catch(() => ({ pin: "" }));
  // Slow down PIN guessing.
  await new Promise((r) => setTimeout(r, 400));
  const role = roleForPin(String(pin ?? ""));
  if (!role) throw new HttpError(401, "PIN ไม่ถูกต้อง");
  const res = NextResponse.json({ role, label: ROLE_LABEL[role] });
  res.cookies.set(STAFF_COOKIE, makeToken(role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: cookieMaxAge,
    path: "/",
  });
  return res;
}
