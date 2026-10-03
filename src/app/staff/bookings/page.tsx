"use client";

import { useState } from "react";
import { baht, Sheet, Spinner, thaiDate } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import type { Booking, DiningSession, OrderItem, Table } from "@/lib/types";

type Row = Booking & { table_code: string | null; preorder: OrderItem[] };
type Board = { tables: (Table & { session: DiningSession | null })[] };

const STATUS: Record<Booking["status"], { text: string; cls: string }> = {
  pending: { text: "รอยืนยัน", cls: "bg-sun-soft text-sun-ink" },
  confirmed: { text: "ยืนยันแล้ว", cls: "bg-brand-soft text-brand-deep" },
  seated: { text: "เข้าโต๊ะแล้ว", cls: "bg-brand text-white" },
  rejected: { text: "ปฏิเสธ", cls: "bg-line text-muted" },
  cancelled: { text: "ยกเลิก", cls: "bg-line text-muted" },
};

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const bangkokToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export default function BookingsPage() {
  const [today] = useState(bangkokToday);
  const [date, setDate] = useState(today);
  const { data, mutate } = useApi<Row[]>("bookings", { date }, { refreshInterval: 5000 });
  const [seating, setSeating] = useState<Row | null>(null);

  const act = async (id: string, status: Booking["status"]) => {
    if (status !== "confirmed" && !confirm(status === "rejected" ? "ปฏิเสธการจองนี้?" : "ยกเลิกการจองนี้?")) return;
    await api("setBookingStatus", { id, status }).catch((e) => alert(e.message));
    mutate();
  };

  const live = (data ?? []).filter((b) => !["rejected", "cancelled"].includes(b.status));
  const guests = live.reduce((s, b) => s + b.party_size, 0);

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-brand-deep">การจองโต๊ะ</h1>
        <div className="flex items-center gap-1 rounded-full bg-paper border border-line p-1 ml-auto">
          <button className="h-9 w-9 rounded-full hover:bg-sand" onClick={() => setDate(shift(date, -1))}>‹</button>
          <input type="date" className="bg-transparent px-2 font-semibold" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="h-9 w-9 rounded-full hover:bg-sand" onClick={() => setDate(shift(date, 1))}>›</button>
          {date !== today && (
            <button className="rounded-full px-3 py-1.5 text-sm text-brand" onClick={() => setDate(today)}>วันนี้</button>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        {thaiDate(date, true)} · {live.length} การจอง · {guests} ท่าน
      </p>

      {!data ? (
        <Spinner />
      ) : data.length === 0 ? (
        <p className="py-16 text-center text-muted">ยังไม่มีการจองวันนี้</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {data.map((b) => (
            <article key={b.id} className={`card flex flex-wrap items-center gap-4 p-4 ${["rejected", "cancelled"].includes(b.status) ? "opacity-50" : ""}`}>
              <div className="arch grid h-16 w-14 place-items-center bg-brand text-white font-display text-lg border-2 border-sun">{b.time}</div>
              <div className="flex-1 min-w-48">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{b.name}</span>
                  <span className={`chip ${STATUS[b.status].cls}`}>{STATUS[b.status].text}</span>
                  {b.table_code && <span className="chip bg-sun text-brand-deep">โต๊ะ {b.table_code}</span>}
                </div>
                <div className="text-sm text-muted">
                  {b.party_size} ท่าน · {b.zone === "canal" ? "🌙 ริมคลอง" : "🏮 ในร้าน"} ·{" "}
                  <a className="text-brand underline" href={`tel:${b.phone}`}>{b.phone}</a>
                </div>
                {b.note && <div className="text-sm text-red">📝 {b.note}</div>}
                {b.preorder.length > 0 && (
                  <div className="mt-1 text-sm">
                    🍽 สั่งล่วงหน้า: {b.preorder.map((i) => `${i.name} x${i.qty}`).join(", ")}{" "}
                    <span className="text-muted">({baht(b.preorder.reduce((s, i) => s + i.unit_price * i.qty, 0))})</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {b.status === "pending" && (
                  <>
                    <button className="btn btn-primary py-2 text-sm" onClick={() => act(b.id, "confirmed")}>✓ ยืนยัน</button>
                    <button className="btn btn-danger py-2 text-sm" onClick={() => act(b.id, "rejected")}>ปฏิเสธ</button>
                  </>
                )}
                {(b.status === "pending" || b.status === "confirmed") && (
                  <button className="btn btn-sun py-2 text-sm" onClick={() => setSeating(b)}>🪑 ลูกค้ามาถึง</button>
                )}
                {b.status === "confirmed" && (
                  <button className="btn btn-ghost py-2 text-sm" onClick={() => act(b.id, "cancelled")}>ยกเลิก</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <SeatSheet booking={seating} onClose={() => setSeating(null)} onDone={() => { setSeating(null); mutate(); }} />
    </main>
  );
}

function SeatSheet({ booking, onClose, onDone }: { booking: Row | null; onClose: () => void; onDone: () => void }) {
  const { data } = useApi<Board>(booking ? "cashier" : null);
  const [busy, setBusy] = useState(false);
  if (!booking) return null;
  const tables = (data?.tables ?? []).sort((a, b) => Number(b.zone === booking.zone) - Number(a.zone === booking.zone) || a.seats - b.seats);

  const seat = async (tableId: string) => {
    setBusy(true);
    try {
      await api("seatBooking", { id: booking.id, tableId });
      onDone();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={`พาคุณ${booking.name} (${booking.party_size} ท่าน) เข้าโต๊ะ`}>
      <div className="px-5 pb-6">
        <p className="text-sm text-muted">เลือกโต๊ะว่าง {booking.preorder.length > 0 && "· อาหารที่สั่งล่วงหน้าจะเข้าครัวทันที"}</p>
        {!data ? (
          <Spinner />
        ) : (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {tables.map((t) => {
              const busyTable = Boolean(t.session);
              const small = t.seats < booking.party_size;
              return (
                <button
                  key={t.id}
                  disabled={busy || busyTable}
                  onClick={() => seat(t.id)}
                  className={`arch border-2 pt-4 pb-2 text-center disabled:opacity-30 ${t.zone === booking.zone ? "border-brand" : "border-line"} ${small ? "bg-peach-soft" : "bg-paper"}`}
                >
                  <div className="font-display text-brand-deep">{t.code}</div>
                  <div className="text-[11px] text-muted">{t.seats} ที่</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
