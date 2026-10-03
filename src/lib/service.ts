import "server-only";
import { db, newId, nowIso } from "./db";
import { HttpError } from "./errors";
import { notifyCustomer, notifyStaff } from "./line";
import { tableKey } from "./staff-auth";
import {
  allItemsDone,
  bangkokNow,
  bookingSlots,
  CLOSE_TIME,
  itemsTotal,
  OPEN_TIME,
  promptPayPayload,
  remainingCapacity,
  resolveOptions,
  toMinutes,
  unitPrice,
} from "./logic";
import type {
  Booking,
  BookingStatus,
  CartLine,
  DiningSession,
  ItemStatus,
  Order,
  OrderItem,
  Payment,
  Station,
  Zone,
} from "./types";

const bad = (msg: string) => new HttpError(400, msg);
const notFound = (what: string) => new HttpError(404, `ไม่พบ${what}`);

const PROMPTPAY_ID = process.env.PROMPTPAY_ID ?? "0836544414";
const SHOP_NAME = "อูเล้งคาเฟ่";

/* ---------------------------------------------------------------- menu --- */

export async function getMenu() {
  const [categories, items] = await Promise.all([db().list("menu_categories"), db().list("menu_items")]);
  return {
    categories: categories.sort((a, b) => a.sort - b.sort),
    items: items.sort((a, b) => a.sort - b.sort),
  };
}

/** Turn cart lines into priced order items; rejects sold-out or unknown items. */
async function buildItems(orderId: string, lines: CartLine[], status: ItemStatus): Promise<OrderItem[]> {
  if (!Array.isArray(lines) || lines.length === 0) throw bad("ยังไม่ได้เลือกเมนู");
  const menu = await db().list("menu_items", { id: lines.map((l) => l.menu_item_id) });
  return lines.map((l) => {
    const item = menu.find((m) => m.id === l.menu_item_id);
    if (!item) throw bad("มีเมนูที่ไม่อยู่ในร้านแล้ว");
    if (!item.is_available) throw bad(`ขออภัย "${item.name}" หมดแล้ว`);
    const qty = Math.floor(Number(l.qty));
    if (!(qty >= 1 && qty <= 50)) throw bad("จำนวนไม่ถูกต้อง");
    let options;
    try {
      options = resolveOptions(item, l.options ?? []);
    } catch (e) {
      throw bad((e as Error).message);
    }
    return {
      id: newId(),
      order_id: orderId,
      menu_item_id: item.id,
      name: item.name,
      unit_price: unitPrice(Number(item.price), options),
      qty,
      options,
      note: String(l.note ?? "").slice(0, 200),
      station: item.station,
      status,
      created_at: nowIso(),
    };
  });
}

async function insertItems(items: OrderItem[]) {
  for (const it of items) await db().insert("order_items", it);
}

const summarize = (items: OrderItem[]) => items.map((i) => `• ${i.name} x${i.qty}`).join("\n");

/* ------------------------------------------------------------ customers --- */

export async function upsertCustomer(p: { userId: string; displayName: string; pictureUrl: string | null }) {
  const existing = await db().get("customers", p.userId);
  const row = { id: p.userId, display_name: p.displayName, picture_url: p.pictureUrl };
  if (!existing) await db().insert("customers", row);
  else if (existing.display_name !== p.displayName || existing.picture_url !== p.pictureUrl)
    await db().update("customers", p.userId, row);
}

export async function myActivity(userId: string) {
  const today = bangkokNow().date;
  const [bookings, orders] = await Promise.all([
    db().list("bookings", { line_user_id: userId }),
    db().list("orders", { line_user_id: userId, type: "takeaway" }),
  ]);
  return {
    bookings: bookings
      .filter((b) => b.date >= today && ["pending", "confirmed"].includes(b.status))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    takeaways: orders
      .filter((o) => !["picked_up", "cancelled"].includes(o.status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

/* ------------------------------------------------------------- bookings --- */

function checkBookingInput(q: { date: string; time?: string; partySize: number; zone: Zone }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.date)) throw bad("วันที่ไม่ถูกต้อง");
  if (!["indoor", "canal"].includes(q.zone)) throw bad("โซนไม่ถูกต้อง");
  if (!(q.partySize >= 1 && q.partySize <= 20)) throw bad("จำนวนคน 1–20 ท่าน");
  const now = bangkokNow();
  if (q.date < now.date) throw bad("เลือกวันที่ผ่านมาแล้วไม่ได้");
  if (q.time !== undefined) {
    if (!bookingSlots().includes(q.time)) throw bad("เวลาไม่ถูกต้อง");
    if (q.date === now.date && toMinutes(q.time) < toMinutes(now.time) + 30)
      throw bad("จองล่วงหน้าอย่างน้อย 30 นาที");
  }
}

export async function availability(q: { date: string; partySize: number; zone: Zone }) {
  checkBookingInput(q);
  const [tables, bookings] = await Promise.all([db().list("tables"), db().list("bookings", { date: q.date })]);
  const now = bangkokNow();
  return bookingSlots().map((time) => ({
    time,
    left:
      q.date === now.date && toMinutes(time) < toMinutes(now.time) + 30
        ? 0
        : remainingCapacity(tables, bookings, { ...q, time }),
  }));
}

export async function createBooking(
  userId: string,
  input: { name: string; phone: string; partySize: number; date: string; time: string; zone: Zone; note?: string; preorder?: CartLine[] },
) {
  const name = String(input.name ?? "").trim();
  const phone = String(input.phone ?? "").replace(/[^0-9]/g, "");
  if (!name) throw bad("กรุณากรอกชื่อ");
  if (!/^0\d{8,9}$/.test(phone)) throw bad("เบอร์โทรไม่ถูกต้อง");
  const partySize = Number(input.partySize);
  checkBookingInput({ ...input, partySize });

  const [tables, bookings] = await Promise.all([db().list("tables"), db().list("bookings", { date: input.date })]);
  if (remainingCapacity(tables, bookings, { ...input, partySize }) < 1)
    throw new HttpError(409, "ช่วงเวลานี้เต็มแล้ว ลองเลือกเวลาอื่นนะคะ");

  const booking: Booking = {
    id: newId(),
    line_user_id: userId,
    name,
    phone,
    party_size: partySize,
    date: input.date,
    time: input.time,
    zone: input.zone,
    note: String(input.note ?? "").slice(0, 300),
    status: "pending",
    table_id: null,
    created_at: nowIso(),
  };

  let preorderItems: OrderItem[] = [];
  let order: Order | null = null;
  if (input.preorder?.length) {
    order = {
      id: newId(),
      type: "preorder",
      session_id: null,
      booking_id: booking.id,
      line_user_id: userId,
      customer_name: name,
      pickup_time: null,
      status: "placed",
      note: "",
      created_at: nowIso(),
    };
    preorderItems = await buildItems(order.id, input.preorder, "held");
  }

  await db().insert("bookings", booking);
  if (order) {
    await db().insert("orders", order);
    await insertItems(preorderItems);
  }

  notifyStaff(
    `📅 จองโต๊ะใหม่ (รอยืนยัน)\n${name} ${partySize} ท่าน\n${input.date} ${input.time} · ${input.zone === "canal" ? "ริมคลอง" : "ในร้าน"}` +
      (preorderItems.length ? `\nสั่งล่วงหน้า:\n${summarize(preorderItems)}` : ""),
  );
  return booking;
}

export async function cancelMyBooking(userId: string, id: string) {
  const b = await db().get("bookings", id);
  if (!b || b.line_user_id !== userId) throw notFound("การจอง");
  if (!["pending", "confirmed"].includes(b.status)) throw bad("ยกเลิกการจองนี้ไม่ได้แล้ว");
  await db().update("bookings", id, { status: "cancelled" });
  notifyStaff(`❌ ลูกค้ายกเลิกจอง: ${b.name} ${b.date} ${b.time}`);
}

export async function bookingsForDate(date: string) {
  const [bookings, tables] = await Promise.all([db().list("bookings", { date }), db().list("tables")]);
  const orders = await db().list("orders", { booking_id: bookings.map((b) => b.id), type: "preorder" });
  const items = await db().list("order_items", { order_id: orders.map((o) => o.id) });
  return bookings
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((b) => {
      const oids = orders.filter((o) => o.booking_id === b.id).map((o) => o.id);
      return {
        ...b,
        table_code: tables.find((t) => t.id === b.table_id)?.code ?? null,
        preorder: items.filter((i) => oids.includes(i.order_id)),
      };
    });
}

const BOOKING_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: ["cancelled"],
};

export async function setBookingStatus(id: string, status: BookingStatus) {
  const b = await db().get("bookings", id);
  if (!b) throw notFound("การจอง");
  if (!BOOKING_TRANSITIONS[b.status]?.includes(status)) throw bad("เปลี่ยนสถานะนี้ไม่ได้");
  await db().update("bookings", id, { status });
  const when = `${thaiDate(b.date)} เวลา ${b.time} น.`;
  if (status === "confirmed")
    notifyCustomer(b.line_user_id, `✅ ${SHOP_NAME} ยืนยันการจองแล้วค่ะ\n${b.name} ${b.party_size} ท่าน\n${when}\nแล้วพบกันนะคะ 🧋`);
  if (status === "rejected")
    notifyCustomer(b.line_user_id, `ขออภัยค่ะ ${SHOP_NAME} ไม่สามารถรับจอง ${when} ได้ ลองเลือกเวลาอื่นได้เลยนะคะ 🙏`);
  if (status === "cancelled")
    notifyCustomer(b.line_user_id, `การจองวันที่ ${when} ถูกยกเลิกแล้วค่ะ`);
}

/** Guest arrived: open a session on the chosen table and fire any pre-order to the kitchen. */
export async function seatBooking(id: string, tableId: string) {
  const b = await db().get("bookings", id);
  if (!b) throw notFound("การจอง");
  if (!["pending", "confirmed"].includes(b.status)) throw bad("การจองนี้เข้าโต๊ะไม่ได้");
  const session = await openSession(tableId, b.id);
  await db().update("bookings", id, { status: "seated", table_id: tableId });
  const orders = await db().list("orders", { booking_id: id, type: "preorder" });
  for (const o of orders) {
    await db().update("orders", o.id, { session_id: session.id });
    for (const it of await db().list("order_items", { order_id: o.id, status: "held" }))
      await db().update("order_items", it.id, { status: "queued" });
  }
  return session;
}

/* -------------------------------------------------------------- dine-in --- */

async function liveSession(tableId: string) {
  const sessions = await db().list("dining_sessions", { table_id: tableId, status: ["open", "bill_requested"] });
  return sessions[0] ?? null;
}

async function openSession(tableId: string, bookingId: string | null): Promise<DiningSession> {
  const table = await db().get("tables", tableId);
  if (!table) throw notFound("โต๊ะ");
  const existing = await liveSession(tableId);
  if (existing) {
    if (bookingId && !existing.booking_id) await db().update("dining_sessions", existing.id, { booking_id: bookingId });
    return existing;
  }
  try {
    return await db().insert("dining_sessions", {
      id: newId(),
      table_id: tableId,
      booking_id: bookingId,
      status: "open",
      opened_at: nowIso(),
      closed_at: null,
    });
  } catch (e) {
    // Two guests scanned at the same moment: the unique index let only one through.
    const s = await liveSession(tableId);
    if (s) return s;
    throw e;
  }
}

/** A guest scanned the QR on a table. */
export async function joinTable(tableCode: string, key: string) {
  const [table] = await db().list("tables", { code: tableCode.toUpperCase() });
  if (!table || key !== tableKey(table.code)) throw notFound("โต๊ะนี้ กรุณาสแกน QR ที่โต๊ะอีกครั้ง");
  const session = await openSession(table.id, null);
  return { table, session };
}

export async function sessionView(sessionId: string) {
  const session = await db().get("dining_sessions", sessionId);
  if (!session) throw notFound("บิลโต๊ะ");
  const [table, orders, payments] = await Promise.all([
    db().get("tables", session.table_id),
    db().list("orders", { session_id: sessionId }),
    db().list("payments", { target_type: "session", target_id: sessionId }),
  ]);
  const items = await db().list("order_items", { order_id: orders.map((o) => o.id) });
  items.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { session, table, items, total: itemsTotal(items), payments };
}

async function placeDineIn(userId: string, name: string, sessionId: string, lines: CartLine[]) {
  const session = await db().get("dining_sessions", sessionId);
  if (!session) throw notFound("บิลโต๊ะ");
  if (session.status === "paid") throw bad("โต๊ะนี้ชำระเงินแล้ว กรุณาสแกน QR ที่โต๊ะอีกครั้ง");
  const order: Order = {
    id: newId(),
    type: "dine_in",
    session_id: sessionId,
    booking_id: session.booking_id,
    line_user_id: userId,
    customer_name: name,
    pickup_time: null,
    status: "placed",
    note: "",
    created_at: nowIso(),
  };
  const items = await buildItems(order.id, lines, "queued");
  await db().insert("orders", order);
  await insertItems(items);
  // Ordering more re-opens a bill that was requested but not yet paid.
  if (session.status === "bill_requested") await db().update("dining_sessions", sessionId, { status: "open" });
  const table = await db().get("tables", session.table_id);
  notifyStaff(`🍽 โต๊ะ ${table?.code} สั่งอาหาร\n${summarize(items)}`);
  return order;
}

export async function requestBill(sessionId: string) {
  const v = await sessionView(sessionId);
  if (v.session.status === "paid") throw bad("โต๊ะนี้ชำระเงินแล้ว");
  if (v.total <= 0) throw bad("ยังไม่มีรายการอาหาร");
  await db().update("dining_sessions", sessionId, { status: "bill_requested" });
  notifyStaff(`🧾 โต๊ะ ${v.table?.code} ขอเช็กบิล ฿${v.total}`);
}

/* ------------------------------------------------------------- takeaway --- */

/** Pickup times every 15 min, at least 20 min from now, until 30 min before close. */
export function pickupSlots(): string[] {
  const now = bangkokNow();
  const earliest = Math.max(toMinutes(OPEN_TIME), toMinutes(now.time) + 20);
  const out: string[] = [];
  for (let t = Math.ceil(earliest / 15) * 15; t <= toMinutes(CLOSE_TIME) - 30; t += 15) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
}

async function placeTakeaway(userId: string, name: string, pickupTime: string, note: string, lines: CartLine[]) {
  if (!pickupSlots().includes(pickupTime)) throw bad("เวลารับไม่ถูกต้อง หรือร้านปิดรับออเดอร์แล้ว");
  const order: Order = {
    id: newId(),
    type: "takeaway",
    session_id: null,
    booking_id: null,
    line_user_id: userId,
    customer_name: String(name).trim().slice(0, 60) || "ลูกค้า",
    pickup_time: pickupTime,
    status: "awaiting_payment",
    note: String(note ?? "").slice(0, 300),
    created_at: nowIso(),
  };
  // Held until the slip is verified: the shop only cooks paid takeaway orders.
  const items = await buildItems(order.id, lines, "held");
  await db().insert("orders", order);
  await insertItems(items);
  return order;
}

export async function placeOrder(
  userId: string,
  displayName: string,
  input: { type: "dine_in" | "takeaway"; sessionId?: string; pickupTime?: string; name?: string; note?: string; lines: CartLine[] },
) {
  if (input.type === "dine_in") return placeDineIn(userId, displayName, String(input.sessionId), input.lines);
  if (input.type === "takeaway")
    return placeTakeaway(userId, input.name || displayName, String(input.pickupTime), input.note ?? "", input.lines);
  throw bad("ประเภทออเดอร์ไม่ถูกต้อง");
}

export async function orderView(userId: string | null, orderId: string) {
  const order = await db().get("orders", orderId);
  if (!order || (userId !== null && order.line_user_id !== userId)) throw notFound("ออเดอร์");
  const [items, payments] = await Promise.all([
    db().list("order_items", { order_id: orderId }),
    db().list("payments", { target_type: "order", target_id: orderId }),
  ]);
  return { order, items, total: itemsTotal(items), payments };
}

export async function pickupOrder(orderId: string) {
  const o = await db().get("orders", orderId);
  if (!o || o.type !== "takeaway") throw notFound("ออเดอร์");
  if (o.status !== "ready" && o.status !== "placed") throw bad("ออเดอร์นี้ยังรับไม่ได้");
  await db().update("orders", orderId, { status: "picked_up" });
  // Clear the bag off the kitchen's "ready" column.
  for (const it of await db().list("order_items", { order_id: orderId, status: ["queued", "cooking", "ready"] }))
    await db().update("order_items", it.id, { status: "served" });
}

/* -------------------------------------------------------------- payment --- */

async function amountDue(targetType: Payment["target_type"], targetId: string) {
  if (targetType === "session") {
    const v = await sessionView(targetId);
    if (v.session.status === "paid") throw bad("ชำระเงินเรียบร้อยแล้ว");
    return { amount: v.total, label: `โต๊ะ ${v.table?.code}` };
  }
  const o = await db().get("orders", targetId);
  if (!o) throw notFound("ออเดอร์");
  if (o.status !== "awaiting_payment") throw bad("ชำระเงินเรียบร้อยแล้ว");
  const items = await db().list("order_items", { order_id: targetId });
  return { amount: itemsTotal(items), label: `สั่งกลับบ้าน · ${o.customer_name}` };
}

async function isPaid(targetType: Payment["target_type"], targetId: string) {
  if (targetType === "session") return (await db().get("dining_sessions", targetId))?.status === "paid";
  const o = await db().get("orders", targetId);
  return Boolean(o && o.status !== "awaiting_payment");
}

export async function payInfo(targetType: Payment["target_type"], targetId: string) {
  if (await isPaid(targetType, targetId)) return { paid: true as const };
  const due = await amountDue(targetType, targetId);
  const pending = (await db().list("payments", { target_type: targetType, target_id: targetId, status: "pending" }))[0];
  return {
    paid: false as const,
    ...due,
    promptpayId: PROMPTPAY_ID,
    payload: promptPayPayload(PROMPTPAY_ID, due.amount),
    pending: pending ?? null,
  };
}

export async function submitPayment(input: {
  targetType: Payment["target_type"];
  targetId: string;
  method: Payment["method"];
  slip?: File | null;
}) {
  if (!["session", "order"].includes(input.targetType)) throw bad("ข้อมูลไม่ถูกต้อง");
  if (!["promptpay", "cash"].includes(input.method)) throw bad("วิธีชำระเงินไม่ถูกต้อง");
  if (input.targetType === "order" && input.method === "cash") throw bad("สั่งกลับบ้านต้องชำระก่อนค่ะ");
  const due = await amountDue(input.targetType, input.targetId);

  let slipRef: string | null = null;
  if (input.method === "promptpay") {
    const slip = input.slip;
    if (!slip || slip.size === 0) throw bad("กรุณาแนบสลิป");
    if (slip.size > 5 * 1024 * 1024) throw bad("ไฟล์สลิปใหญ่เกิน 5MB");
    if (!/^image\/(jpeg|png|webp|heic)$/.test(slip.type)) throw bad("สลิปต้องเป็นรูปภาพ");
    const ext = slip.type.split("/")[1];
    slipRef = await db().upload(`slips/${newId()}.${ext}`, await slip.arrayBuffer(), slip.type);
  }

  // A fresh submission replaces any earlier unverified one.
  for (const p of await db().list("payments", { target_type: input.targetType, target_id: input.targetId, status: "pending" }))
    await db().update("payments", p.id, { status: "rejected" });

  const payment = await db().insert("payments", {
    id: newId(),
    target_type: input.targetType,
    target_id: input.targetId,
    amount: due.amount,
    method: input.method,
    slip_url: slipRef,
    status: "pending",
    created_at: nowIso(),
    verified_at: null,
  });
  notifyStaff(
    input.method === "cash"
      ? `💵 ${due.label} ขอจ่ายเงินสด ฿${due.amount}`
      : `🧾 สลิปใหม่รอตรวจ: ${due.label} ฿${due.amount}`,
  );
  return payment;
}

export async function verifyPayment(paymentId: string, approve: boolean) {
  const p = await db().get("payments", paymentId);
  if (!p || p.status !== "pending") throw notFound("รายการรอตรวจ");
  await db().update("payments", paymentId, { status: approve ? "verified" : "rejected", verified_at: nowIso() });

  if (p.target_type === "session") {
    if (approve) await db().update("dining_sessions", p.target_id, { status: "paid", closed_at: nowIso() });
    return;
  }
  const order = await db().get("orders", p.target_id);
  if (!order) return;
  if (!approve) {
    notifyCustomer(order.line_user_id, `สลิปของออเดอร์กลับบ้านยังตรวจสอบไม่ผ่านค่ะ กรุณาแนบสลิปใหม่อีกครั้ง 🙏`);
    return;
  }
  await db().update("orders", order.id, { status: "placed" });
  const items = await db().list("order_items", { order_id: order.id, status: "held" });
  for (const it of items) await db().update("order_items", it.id, { status: "queued" });
  notifyCustomer(order.line_user_id, `✅ ได้รับชำระเงินแล้วค่ะ ร้านกำลังเตรียมอาหาร\nรับได้เวลา ${order.pickup_time} น.`);
  notifyStaff(`🛍 กลับบ้าน (จ่ายแล้ว) ${order.customer_name} รับ ${order.pickup_time}\n${summarize(items)}`);
}

/** Cashier takes cash at the table and closes the bill in one step. */
export async function settleCash(sessionId: string) {
  const v = await sessionView(sessionId);
  if (v.session.status === "paid") throw bad("ชำระเงินเรียบร้อยแล้ว");
  for (const p of v.payments.filter((p) => p.status === "pending"))
    await db().update("payments", p.id, { status: "rejected" });
  await db().insert("payments", {
    id: newId(),
    target_type: "session",
    target_id: sessionId,
    amount: v.total,
    method: "cash",
    slip_url: null,
    status: "verified",
    created_at: nowIso(),
    verified_at: nowIso(),
  });
  await db().update("dining_sessions", sessionId, { status: "paid", closed_at: nowIso() });
}

/* -------------------------------------------------------------- kitchen --- */

const ITEM_FLOW: Partial<Record<ItemStatus, ItemStatus[]>> = {
  queued: ["cooking", "ready", "cancelled"],
  cooking: ["ready", "queued", "cancelled"],
  ready: ["served", "cooking"],
  held: ["cancelled"],
};

export async function kitchenBoard(station: Station | "all") {
  const filter = station === "all" ? {} : { station };
  const items = await db().list("order_items", { ...filter, status: ["queued", "cooking", "ready"] });
  const orders = await db().list("orders", { id: [...new Set(items.map((i) => i.order_id))] });
  const sessions = await db().list("dining_sessions", { id: orders.flatMap((o) => (o.session_id ? [o.session_id] : [])) });
  const tables = await db().list("tables");
  const label = (orderId: string) => {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return { label: "?", kind: "dine_in" as const, pickup: null };
    if (o.type === "takeaway") return { label: `🛍 ${o.customer_name}`, kind: "takeaway" as const, pickup: o.pickup_time };
    const s = sessions.find((x) => x.id === o.session_id);
    return { label: `โต๊ะ ${tables.find((t) => t.id === s?.table_id)?.code ?? "?"}`, kind: "dine_in" as const, pickup: null };
  };
  return items
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((i) => ({ ...i, ...label(i.order_id) }));
}

export async function setItemStatus(itemId: string, status: ItemStatus, station: Station | "all") {
  const it = await db().get("order_items", itemId);
  if (!it || (station !== "all" && it.station !== station)) throw notFound("รายการ");
  if (!ITEM_FLOW[it.status]?.includes(status)) throw bad("เปลี่ยนสถานะนี้ไม่ได้");
  await db().update("order_items", itemId, { status });

  const order = await db().get("orders", it.order_id);
  if (order?.type === "takeaway" && order.status === "placed") {
    const items = await db().list("order_items", { order_id: order.id });
    if (allItemsDone(items)) {
      await db().update("orders", order.id, { status: "ready" });
      notifyCustomer(order.line_user_id, `🛍 อาหารของคุณ${order.customer_name}พร้อมรับแล้วค่ะ\nแวะรับที่เคาน์เตอร์ ${SHOP_NAME} ได้เลย`);
    }
  }
}

export async function setMenuAvailability(id: string, isAvailable: boolean) {
  await db().update("menu_items", id, { is_available: isAvailable });
}

/* ------------------------------------------------------------- cashier --- */

export async function cashierBoard() {
  const [tables, sessions, pending, takeaways] = await Promise.all([
    db().list("tables"),
    db().list("dining_sessions", { status: ["open", "bill_requested"] }),
    db().list("payments", { status: "pending" }),
    db().list("orders", { type: "takeaway", status: ["awaiting_payment", "placed", "ready"] }),
  ]);
  const orders = await db().list("orders", { session_id: sessions.map((s) => s.id) });
  const allOrderIds = [...orders, ...takeaways].map((o) => o.id);
  const items = await db().list("order_items", { order_id: allOrderIds });
  const totalOf = (orderIds: string[]) => itemsTotal(items.filter((i) => orderIds.includes(i.order_id)));

  return {
    tables: tables
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((t) => {
        const s = sessions.find((x) => x.table_id === t.id) ?? null;
        const oids = s ? orders.filter((o) => o.session_id === s.id).map((o) => o.id) : [];
        const its = items.filter((i) => oids.includes(i.order_id));
        return {
          ...t,
          session: s,
          total: totalOf(oids),
          waiting: its.filter((i) => ["queued", "cooking"].includes(i.status)).length,
          toServe: its.filter((i) => i.status === "ready").length,
          pendingPayment: s ? pending.some((p) => p.target_id === s.id) : false,
        };
      }),
    payments: await Promise.all(
      pending
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map(async (p) => {
          let label = "";
          if (p.target_type === "session") {
            const s = sessions.find((x) => x.id === p.target_id);
            label = `โต๊ะ ${tables.find((t) => t.id === s?.table_id)?.code ?? "?"}`;
          } else {
            const o = takeaways.find((x) => x.id === p.target_id);
            label = `🛍 ${o?.customer_name ?? "?"} · รับ ${o?.pickup_time ?? "-"}`;
          }
          return { ...p, label, slip_view: p.slip_url ? await db().fileUrl(p.slip_url) : null };
        }),
    ),
    takeaways: takeaways
      .sort((a, b) => String(a.pickup_time).localeCompare(String(b.pickup_time)))
      .map((o) => ({ ...o, total: totalOf([o.id]), items: items.filter((i) => i.order_id === o.id) })),
  };
}

export async function tableQrs() {
  const tables = await db().list("tables");
  return tables
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((t) => ({ ...t, path: `/liff/t/${t.code}/${tableKey(t.code)}` }));
}

export async function staffOpenTable(tableId: string) {
  return openSession(tableId, null);
}

/* ---------------------------------------------------------------- admin --- */

export async function updateMenuItem(
  id: string,
  patch: { name?: string; description?: string; price?: number; is_available?: boolean; is_signature?: boolean; image_url?: string | null },
) {
  const clean: Record<string, unknown> = {};
  if (patch.name !== undefined) clean.name = String(patch.name).trim().slice(0, 80);
  if (patch.description !== undefined) clean.description = String(patch.description).slice(0, 300);
  if (patch.price !== undefined) {
    const price = Number(patch.price);
    if (!(price >= 0 && price < 100000)) throw bad("ราคาไม่ถูกต้อง");
    clean.price = price;
  }
  if (patch.is_available !== undefined) clean.is_available = Boolean(patch.is_available);
  if (patch.is_signature !== undefined) clean.is_signature = Boolean(patch.is_signature);
  if (patch.image_url !== undefined) clean.image_url = patch.image_url ? String(patch.image_url) : null;
  return db().update("menu_items", id, clean);
}

export async function salesToday() {
  const today = bangkokNow().date;
  const payments = await db().list("payments", { status: "verified" });
  const todays = payments.filter((p) => p.verified_at && bangkokNow(new Date(p.verified_at)).date === today);
  return {
    total: todays.reduce((s, p) => s + Number(p.amount), 0),
    count: todays.length,
    promptpay: todays.filter((p) => p.method === "promptpay").reduce((s, p) => s + Number(p.amount), 0),
    cash: todays.filter((p) => p.method === "cash").reduce((s, p) => s + Number(p.amount), 0),
  };
}

/* -------------------------------------------------------------- helpers --- */

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function thaiDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_MONTHS[m - 1]} ${y + 543}`;
}
