import generatePayload from "promptpay-qr";
import type { Booking, MenuItem, OrderItem, SelectedOption, Table } from "./types";

export const OPEN_TIME = "12:00";
export const CLOSE_TIME = "24:00"; // kitchen last order 23:30 (see pickupSlots)
export const BOOKING_MINUTES = 120;
export const SLOT_STEP_MINUTES = 30;

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const fromMinutes = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** Booking start times: every 30 min from opening until 2h before closing. */
export function bookingSlots(): string[] {
  const out: string[] = [];
  for (let t = toMinutes(OPEN_TIME); t + BOOKING_MINUTES <= toMinutes(CLOSE_TIME); t += SLOT_STEP_MINUTES) {
    out.push(fromMinutes(t));
  }
  return out;
}

export const ACTIVE_BOOKING = new Set(["pending", "confirmed", "seated"]);

/** Floor plan grid size, in cells. Table/decor positions are stored in these units. */
export const FLOOR_COLS = 24;
export const FLOOR_ROWS = 18;

/** Biggest spare capacity we hand out, so 2 guests don't take the 8-seater. */
export const MAX_SPARE_SEATS = 3;

export const tableFits = (seats: number, partySize: number) => seats >= partySize && seats <= partySize + MAX_SPARE_SEATS;

export type TableState = "free" | "taken" | "unfit";

/** Per-table booking state for a party at date/time (active tables only). */
export function tableStates(
  tables: Table[],
  bookings: Booking[],
  q: { date: string; time: string; partySize: number },
): (Table & { state: TableState })[] {
  const start = toMinutes(q.time);
  const takenIds = new Set(
    bookings
      .filter(
        (b) =>
          b.table_id &&
          ACTIVE_BOOKING.has(b.status) &&
          b.date === q.date &&
          Math.abs(toMinutes(b.time) - start) < BOOKING_MINUTES,
      )
      .map((b) => b.table_id),
  );
  return tables
    .filter((t) => t.active)
    .map((t) => ({
      ...t,
      state: takenIds.has(t.id) ? "taken" : tableFits(t.seats, q.partySize) ? "free" : "unfit",
    }));
}

/**
 * Re-price the customer's chosen options against the menu definition.
 * Never trust prices sent from the client.
 */
export function resolveOptions(item: MenuItem, chosen: SelectedOption[]): SelectedOption[] {
  const out: SelectedOption[] = [];
  for (const group of item.options) {
    const picks = chosen.filter((c) => c.group === group.name);
    if (group.required && picks.length === 0) {
      throw new Error(`กรุณาเลือก "${group.name}" สำหรับ ${item.name}`);
    }
    if (!group.multi && picks.length > 1) {
      throw new Error(`"${group.name}" เลือกได้ 1 อย่าง`);
    }
    for (const p of picks) {
      const choice = group.choices.find((c) => c.label === p.label);
      if (!choice) throw new Error(`ไม่มีตัวเลือก "${p.label}"`);
      out.push({ group: group.name, label: choice.label, price: choice.price });
    }
  }
  const unknown = chosen.find((c) => !item.options.some((g) => g.name === c.group));
  if (unknown) throw new Error(`ไม่มีตัวเลือก "${unknown.group}"`);
  return out;
}

export const unitPrice = (base: number, options: SelectedOption[]) =>
  base + options.reduce((s, o) => s + o.price, 0);

export const itemsTotal = (items: Pick<OrderItem, "unit_price" | "qty" | "status">[]) =>
  items.filter((i) => i.status !== "cancelled").reduce((s, i) => s + i.unit_price * i.qty, 0);

/** A takeaway order is ready once every live item has left the kitchen. */
export function allItemsDone(items: Pick<OrderItem, "status">[]): boolean {
  const live = items.filter((i) => i.status !== "cancelled");
  return live.length > 0 && live.every((i) => i.status === "ready" || i.status === "served");
}

export function promptPayPayload(promptPayId: string, amount: number): string {
  return generatePayload(promptPayId, { amount });
}

/** Current date/time in Bangkok as {date: YYYY-MM-DD, time: HH:mm}. */
export function bangkokNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;
