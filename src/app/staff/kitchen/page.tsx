"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStaff } from "@/components/StaffShell";
import { Sheet, Spinner } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import type { ItemStatus, MenuItem, OrderItem, Station } from "@/lib/types";

type KItem = OrderItem & { label: string; kind: "dine_in" | "takeaway"; pickup: string | null };

const COLS: { status: ItemStatus; title: string; tint: string; next: ItemStatus; action: string }[] = [
  { status: "queued", title: "ออเดอร์ใหม่", tint: "bg-sun-soft", next: "cooking", action: "เริ่มทำ" },
  { status: "cooking", title: "กำลังทำ", tint: "bg-peach-soft", next: "ready", action: "เสร็จแล้ว" },
  { status: "ready", title: "รอเสิร์ฟ / รอรับ", tint: "bg-brand-soft", next: "served", action: "เสิร์ฟแล้ว" },
];

function minutesAgo(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

/** Short chime when new tickets arrive (kitchens are loud). */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch {}
}

export default function KitchenPage() {
  const me = useStaff();
  const fixed = me.role === "somtam" || me.role === "cafe";
  const [station, setStation] = useState<Station | "all">(fixed ? (me.role as Station) : "all");
  const { data, mutate } = useApi<KItem[]>("kitchen", { station }, { refreshInterval: 3000 });
  const [now, setNow] = useState(() => Date.now());
  const [stockOpen, setStockOpen] = useState(false);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.filter((i) => i.status === "queued").map((i) => i.id));
    if (seen.current && [...ids].some((id) => !seen.current!.has(id))) chime();
    seen.current = ids;
  }, [data]);

  const move = async (item: KItem, status: ItemStatus) => {
    // optimistic
    mutate((prev) => prev?.map((i) => (i.id === item.id ? { ...i, status } : i)).filter((i) => i.status !== "served" && i.status !== "cancelled"), false);
    await api("setItemStatus", { itemId: item.id, status }).catch((e) => alert(e.message));
    mutate();
  };

  return (
    <main className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h1 className="font-display text-2xl text-brand-deep mr-2">จอครัว</h1>
        {!fixed &&
          (["all", "somtam", "cafe"] as const).map((s) => (
            <button key={s} onClick={() => setStation(s)} className={`rounded-full px-4 py-1.5 text-sm ${station === s ? "bg-brand text-white" : "bg-paper border border-line"}`}>
              {s === "all" ? "ทั้งหมด" : s === "somtam" ? "🥗 ครัวส้มตำ" : "🧋 คาเฟ่"}
            </button>
          ))}
        {fixed && <span className="chip bg-brand text-white text-sm px-3 py-1">{station === "somtam" ? "🥗 ครัวส้มตำ" : "🧋 เคาน์เตอร์คาเฟ่"}</span>}
        <button className="btn btn-ghost ml-auto py-2 text-sm" onClick={() => setStockOpen(true)}>
          🚫 ของหมด
        </button>
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLS.map((col) => {
            const items = data.filter((i) => i.status === col.status);
            const tickets = groupTickets(items);
            return (
              <section key={col.status} className="rounded-3xl bg-paper/60 border border-line p-3 min-h-[60vh]">
                <h2 className={`flex items-center justify-between rounded-2xl ${col.tint} px-4 py-2 font-semibold`}>
                  {col.title} <span className="chip bg-paper">{items.length}</span>
                </h2>
                <div className="mt-3 grid gap-3">
                  {tickets.map((t) => {
                    const age = minutesAgo(t.items[0].created_at, now);
                    return (
                      <article key={t.orderId} className={`card overflow-hidden animate-pop ${age >= 15 && col.status !== "ready" ? "ring-2 ring-red" : ""}`}>
                        <header className={`flex items-center justify-between px-4 py-2 ${t.kind === "takeaway" ? "bg-sun text-brand-deep" : "bg-brand text-white"}`}>
                          <span className="font-display text-lg">{t.label}</span>
                          <span className="text-sm opacity-90">
                            {t.pickup ? `รับ ${t.pickup} · ` : ""}
                            {age} นาที
                          </span>
                        </header>
                        <ul className="divide-y divide-line">
                          {t.items.map((i) => (
                            <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sand font-bold">{i.qty}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold leading-snug">
                                  {i.name}
                                  {station === "all" && <span className="ml-1 text-xs text-muted">{i.station === "somtam" ? "🥗" : "🧋"}</span>}
                                </div>
                                {i.options.length > 0 && <div className="text-sm text-brand-deep">{i.options.map((o) => o.label).join(" · ")}</div>}
                                {i.note && <div className="text-sm text-red">📝 {i.note}</div>}
                              </div>
                              <div className="flex flex-col gap-1">
                                <button className="btn btn-primary py-2 px-3 text-sm" onClick={() => move(i, col.next)}>
                                  {col.status === "ready" && t.kind === "takeaway" ? "ส่งมอบแล้ว" : col.action}
                                </button>
                                {col.status === "queued" && (
                                  <button
                                    className="text-xs text-muted hover:text-red"
                                    onClick={() => confirm(`ยกเลิก ${i.name}?`) && move(i, "cancelled")}
                                  >
                                    ยกเลิก
                                  </button>
                                )}
                                {col.status !== "queued" && (
                                  <button className="text-xs text-muted" onClick={() => move(i, col.status === "ready" ? "cooking" : "queued")}>
                                    ↩ ย้อนกลับ
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </article>
                    );
                  })}
                  {tickets.length === 0 && <p className="py-10 text-center text-sm text-muted">ว่าง ✨</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <StockSheet open={stockOpen} onClose={() => setStockOpen(false)} station={station} />
    </main>
  );
}

function groupTickets(items: KItem[]) {
  const map = new Map<string, { orderId: string; label: string; kind: KItem["kind"]; pickup: string | null; items: KItem[] }>();
  for (const i of items) {
    const t = map.get(i.order_id) ?? { orderId: i.order_id, label: i.label, kind: i.kind, pickup: i.pickup, items: [] };
    t.items.push(i);
    map.set(i.order_id, t);
  }
  return [...map.values()];
}

function StockSheet({ open, onClose, station }: { open: boolean; onClose: () => void; station: Station | "all" }) {
  const { data, mutate } = useApi<{ items: MenuItem[] }>(open ? "menu" : null);
  const items = useMemo(() => (data?.items ?? []).filter((i) => station === "all" || i.station === station), [data, station]);
  const toggle = async (i: MenuItem) => {
    await api("setAvailability", { id: i.id, isAvailable: !i.is_available });
    mutate();
  };
  return (
    <Sheet open={open} onClose={onClose} title="เปิด/ปิด เมนูที่หมด">
      <ul className="px-5 pb-6 divide-y divide-line">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-2.5">
            <span className="text-xl">{i.emoji}</span>
            <span className={`flex-1 ${i.is_available ? "" : "text-muted line-through"}`}>{i.name}</span>
            <button
              onClick={() => toggle(i)}
              className={`relative h-7 w-12 rounded-full transition ${i.is_available ? "bg-brand" : "bg-line"}`}
              aria-label={i.is_available ? "มีของ" : "หมด"}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${i.is_available ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
