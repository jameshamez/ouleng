import { describe, expect, it } from "vitest";
import {
  allItemsDone,
  bangkokNow,
  bookingSlots,
  itemsTotal,
  promptPayPayload,
  remainingCapacity,
  resolveOptions,
  unitPrice,
} from "./logic";
import type { Booking, MenuItem, Table } from "./types";

const tables: Table[] = [
  { id: "a", code: "A1", zone: "indoor", seats: 2 },
  { id: "b", code: "A2", zone: "indoor", seats: 4 },
  { id: "c", code: "A3", zone: "indoor", seats: 6 },
  { id: "d", code: "C1", zone: "canal", seats: 4 },
];

const booking = (p: Partial<Booking>): Booking => ({
  id: Math.random().toString(),
  line_user_id: "u",
  name: "x",
  phone: "",
  party_size: 2,
  date: "2026-10-10",
  time: "18:00",
  zone: "indoor",
  note: "",
  status: "confirmed",
  table_id: null,
  created_at: "",
  ...p,
});

describe("bookingSlots", () => {
  it("runs every 30 minutes from opening until 2h before close", () => {
    const s = bookingSlots();
    expect(s[0]).toBe("12:00");
    expect(s.at(-1)).toBe("21:00");
    expect(s).toContain("18:30");
  });
});

describe("remainingCapacity", () => {
  const q = { date: "2026-10-10", time: "18:00", zone: "indoor" as const, partySize: 2 };

  it("counts fitting tables when nothing is booked", () => {
    expect(remainingCapacity(tables, [], q)).toBe(3);
    expect(remainingCapacity(tables, [], { ...q, partySize: 5 })).toBe(1);
  });

  it("subtracts overlapping bookings, smallest fitting table first", () => {
    const b = [booking({ party_size: 2, time: "17:00" })];
    // the 2-seater is taken, the 4 and 6 seaters are still free
    expect(remainingCapacity(tables, b, q)).toBe(2);
    expect(remainingCapacity(tables, b, { ...q, partySize: 5 })).toBe(1);
  });

  it("ignores bookings outside the 2h window, other zones, dates and dead statuses", () => {
    const b = [
      booking({ time: "20:00" }),
      booking({ zone: "canal" }),
      booking({ date: "2026-10-11" }),
      booking({ status: "cancelled" }),
      booking({ status: "rejected" }),
    ];
    expect(remainingCapacity(tables, b, q)).toBe(3);
  });

  it("reaches zero when the zone is full", () => {
    const b = [booking({}), booking({ party_size: 4 }), booking({ party_size: 6 })];
    expect(remainingCapacity(tables, b, q)).toBe(0);
  });
});

describe("resolveOptions", () => {
  const item: MenuItem = {
    id: "m",
    category_id: "c",
    name: "ตำไทย",
    description: "",
    price: 60,
    image_url: null,
    emoji: "",
    station: "somtam",
    is_available: true,
    is_signature: false,
    sort: 0,
    options: [
      { name: "ความเผ็ด", required: true, multi: false, choices: [{ label: "เผ็ดน้อย", price: 0 }, { label: "เผ็ดมาก", price: 0 }] },
      { name: "เพิ่ม", required: false, multi: true, choices: [{ label: "ปูดอง", price: 15 }, { label: "ไข่เค็ม", price: 20 }] },
    ],
  };

  it("re-prices options from the menu, ignoring client prices", () => {
    const out = resolveOptions(item, [
      { group: "ความเผ็ด", label: "เผ็ดมาก", price: 0 },
      { group: "เพิ่ม", label: "ไข่เค็ม", price: 0 },
    ]);
    expect(out).toEqual([
      { group: "ความเผ็ด", label: "เผ็ดมาก", price: 0 },
      { group: "เพิ่ม", label: "ไข่เค็ม", price: 20 },
    ]);
    expect(unitPrice(item.price, out)).toBe(80);
  });

  it("rejects missing required, multiple single-choice and unknown options", () => {
    expect(() => resolveOptions(item, [])).toThrow("ความเผ็ด");
    expect(() =>
      resolveOptions(item, [
        { group: "ความเผ็ด", label: "เผ็ดน้อย", price: 0 },
        { group: "ความเผ็ด", label: "เผ็ดมาก", price: 0 },
      ]),
    ).toThrow();
    expect(() => resolveOptions(item, [{ group: "ความเผ็ด", label: "นรก", price: 0 }])).toThrow();
    expect(() =>
      resolveOptions(item, [
        { group: "ความเผ็ด", label: "เผ็ดน้อย", price: 0 },
        { group: "ฟรี", label: "x", price: -100 },
      ]),
    ).toThrow();
  });
});

describe("totals and readiness", () => {
  it("excludes cancelled items from totals", () => {
    expect(
      itemsTotal([
        { unit_price: 60, qty: 2, status: "served" },
        { unit_price: 45, qty: 1, status: "cancelled" },
        { unit_price: 39, qty: 1, status: "queued" },
      ]),
    ).toBe(159);
  });

  it("is done only when every live item is ready or served", () => {
    expect(allItemsDone([{ status: "ready" }, { status: "cancelled" }])).toBe(true);
    expect(allItemsDone([{ status: "ready" }, { status: "cooking" }])).toBe(false);
    expect(allItemsDone([{ status: "cancelled" }])).toBe(false);
  });
});

describe("promptPayPayload", () => {
  it("embeds the amount and a CRC", () => {
    const p = promptPayPayload("0836544414", 159);
    expect(p).toContain("5406159.00");
    expect(p).toMatch(/6304[0-9A-F]{4}$/);
  });
});

describe("bangkokNow", () => {
  it("converts to UTC+7", () => {
    expect(bangkokNow(new Date("2026-10-03T20:30:00Z"))).toEqual({ date: "2026-10-04", time: "03:30" });
  });
});
