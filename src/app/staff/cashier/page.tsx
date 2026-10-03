"use client";

import { useState } from "react";
import { baht, ItemStatusChip, Sheet, Spinner } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import { DecorBox, FloorCanvas, FloorLegend, TableBox } from "@/components/FloorPlan";
import type { Booking, DiningSession, FloorDecor, Order, OrderItem, Payment, Table } from "@/lib/types";

type TableCard = Table & {
  session: DiningSession | null;
  total: number;
  waiting: number;
  toServe: number;
  pendingPayment: boolean;
  nextBooking: Booking | null;
};
type Board = {
  tables: TableCard[];
  decor: FloorDecor[];
  payments: (Payment & { label: string; slip_view: string | null })[];
  takeaways: (Order & { total: number; items: OrderItem[] })[];
};

const TA_LABEL: Record<string, { text: string; cls: string }> = {
  awaiting_payment: { text: "รอชำระ", cls: "bg-peach-soft text-red" },
  placed: { text: "กำลังทำ", cls: "bg-sun-soft text-sun-ink" },
  ready: { text: "พร้อมรับ", cls: "bg-brand text-white" },
};

export default function CashierPage() {
  const { data, mutate } = useApi<Board>("cashier", undefined, { refreshInterval: 3000 });
  const [tableId, setTableId] = useState<string | null>(null);
  const [slip, setSlip] = useState<string | null>(null);

  if (!data) return <Spinner />;
  const selected = data.tables.find((t) => t.id === tableId) ?? null;

  const verify = async (id: string, approve: boolean) => {
    if (!approve && !confirm("ปฏิเสธสลิปนี้? ลูกค้าจะได้รับแจ้งให้ส่งใหม่")) return;
    await api("verifyPayment", { paymentId: id, approve }).catch((e) => alert(e.message));
    mutate();
  };

  return (
    <main className="p-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 content-start min-w-0">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
            <h1 className="font-display text-2xl text-brand-deep">ผังร้าน</h1>
            <FloorLegend
              items={[
                { tone: "free", label: "ว่าง" },
                { tone: "busy", label: "กำลังทาน" },
                { tone: "alert", label: "ขอเช็กบิล" },
                { tone: "taken", label: "มีจองวันนี้" },
              ]}
            />
          </div>
          <FloorCanvas minWidth={600}>
            {data.decor.map((d) => (
              <DecorBox key={d.id} d={d} />
            ))}
            {data.tables.map((t) => {
              const st = t.session?.status;
              return (
                <TableBox
                  key={t.id}
                  t={t}
                  tone={st === "bill_requested" ? "alert" : st === "open" ? "busy" : t.nextBooking ? "taken" : "free"}
                  sub={t.session ? baht(t.total) : t.nextBooking ? `จอง ${t.nextBooking.time}` : undefined}
                  onClick={() => setTableId(t.id)}
                  badge={
                    t.pendingPayment ? (
                      <span className="block h-3.5 w-3.5 rounded-full bg-red ring-2 ring-white" title="มีสลิปรอตรวจ" />
                    ) : t.toServe > 0 ? (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-sun px-1 text-[10px] font-bold text-brand-deep ring-2 ring-white" title="รอเสิร์ฟ">
                        {t.toServe}
                      </span>
                    ) : undefined
                  }
                />
              );
            })}
          </FloorCanvas>
        </section>

        <section>
          <h2 className="font-display text-xl text-brand-deep mb-2">🛍 สั่งกลับบ้านวันนี้</h2>
          {data.takeaways.length === 0 && <p className="text-sm text-muted">ยังไม่มี</p>}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {data.takeaways.map((o) => (
              <article key={o.id} className="card p-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg">{o.pickup_time}</span>
                  <span className="font-semibold flex-1 truncate">{o.customer_name}</span>
                  <span className={`chip ${TA_LABEL[o.status].cls}`}>{TA_LABEL[o.status].text}</span>
                </div>
                <div className="mt-1 text-sm text-muted truncate">{o.items.map((i) => `${i.name} x${i.qty}`).join(", ")}</div>
                {o.note && <div className="text-sm text-red">📝 {o.note}</div>}
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-semibold">{baht(o.total)}</span>
                  {(o.status === "ready" || o.status === "placed") && (
                    <button
                      className="btn btn-primary py-1.5 px-3 text-sm"
                      onClick={async () => {
                        if (o.status === "placed" && !confirm("ยังทำไม่ครบ ยืนยันว่าลูกค้ารับแล้ว?")) return;
                        await api("pickupOrder", { orderId: o.id });
                        mutate();
                      }}
                    >
                      ลูกค้ารับแล้ว
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-20 h-fit">
        <section className="card overflow-hidden">
          <div className="bg-brand text-white px-4 py-3 flex items-center justify-between">
            <h2 className="font-display text-lg">รอตรวจชำระเงิน</h2>
            <span className="chip bg-sun text-brand-deep">{data.payments.length}</span>
          </div>
          <div className="divide-y divide-line max-h-[75vh] overflow-y-auto">
            {data.payments.length === 0 && <p className="p-6 text-center text-sm text-muted">ไม่มีรายการค้าง ✨</p>}
            {data.payments.map((p) => (
              <div key={p.id} className="flex gap-3 p-3.5 animate-pop">
                {p.slip_view ? (
                  <button onClick={() => setSlip(p.slip_view)} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.slip_view} alt="สลิป" className="h-24 w-16 rounded-lg border border-line object-cover" />
                  </button>
                ) : (
                  <div className="grid h-24 w-16 shrink-0 place-items-center rounded-lg bg-sun-soft text-3xl">💵</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.label}</div>
                  <div className="font-display text-2xl text-brand-deep">{baht(p.amount)}</div>
                  <div className="text-xs text-muted">
                    {p.method === "cash" ? "ขอจ่ายเงินสด" : "พร้อมเพย์"} · {new Date(p.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button className="btn btn-primary py-1.5 px-3 text-sm flex-1" onClick={() => verify(p.id, true)}>
                      {p.method === "cash" ? "รับเงินแล้ว" : "✓ ยอดเข้าแล้ว"}
                    </button>
                    <button className="btn btn-danger py-1.5 px-3 text-sm" onClick={() => verify(p.id, false)}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <TableSheet table={selected} onClose={() => setTableId(null)} onChanged={() => mutate()} />
      <Sheet open={Boolean(slip)} onClose={() => setSlip(null)} title="สลิป">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {slip && <img src={slip} alt="สลิป" className="mx-auto max-h-[75dvh] px-5 pb-5" />}
      </Sheet>
    </main>
  );
}

function TableSheet({ table, onClose, onChanged }: { table: TableCard | null; onClose: () => void; onChanged: () => void }) {
  const sessionId = table?.session?.id;
  const { data, mutate } = useApi<{ items: OrderItem[]; total: number }>(sessionId ? "staffSession" : null, { sessionId }, { refreshInterval: 4000 });
  const [busy, setBusy] = useState(false);
  if (!table) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
      await mutate();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={`โต๊ะ ${table.code} · ${table.zone === "canal" ? "ริมคลอง" : "ในร้าน"}`}>
      <div className="px-5 pb-6">
        {table.nextBooking && (
          <p className="mb-3 rounded-xl bg-sun-soft px-3 py-2 text-sm text-sun-ink">
            📅 มีจอง {table.nextBooking.time} น. · คุณ{table.nextBooking.name} {table.nextBooking.party_size} ท่าน
          </p>
        )}
        {!table.session ? (
          <div className="py-6 text-center">
            <p className="text-muted">โต๊ะว่าง ลูกค้าสแกน QR ที่โต๊ะได้เลย หรือเปิดบิลให้ลูกค้าที่ไม่ใช้ LINE</p>
            <button className="btn btn-primary mt-4" disabled={busy} onClick={() => run(() => api("openTable", { tableId: table.id }))}>
              เปิดบิลโต๊ะนี้
            </button>
          </div>
        ) : (
          <>
            {!data ? (
              <Spinner />
            ) : (
              <ul className="divide-y divide-line">
                {data.items.map((i) => (
                  <li key={i.id} className={`flex items-center gap-2 py-2.5 ${i.status === "cancelled" ? "opacity-50" : ""}`}>
                    <span className="flex-1 text-sm">
                      {i.name} <span className="text-muted">x{i.qty}</span>
                      {i.options.length > 0 && <span className="block text-xs text-muted">{i.options.map((o) => o.label).join(" · ")}</span>}
                    </span>
                    {i.status === "ready" ? (
                      <button className="chip bg-brand text-white py-1" onClick={() => run(() => api("setItemStatus", { itemId: i.id, status: "served" }))}>
                        เสิร์ฟ ✓
                      </button>
                    ) : (
                      <ItemStatusChip status={i.status} />
                    )}
                    <span className="w-16 text-right text-sm tabular-nums">{baht(i.unit_price * i.qty)}</span>
                  </li>
                ))}
                {data.items.length === 0 && <li className="py-6 text-center text-sm text-muted">ยังไม่มีรายการ</li>}
              </ul>
            )}
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-sand/60 px-4 py-3">
              <span className="font-semibold">ยอดรวม</span>
              <span className="font-display text-2xl text-brand-deep">{baht(data?.total ?? table.total)}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a className="btn btn-ghost text-sm" href={`/liff/table/${table.session.id}`} target="_blank" rel="noreferrer">
                เปิดหน้าลูกค้า
              </a>
              <button
                className="btn btn-sun text-sm"
                disabled={busy || !data}
                onClick={() =>
                  confirm(data!.total > 0 ? `รับเงินสด ${baht(data!.total)} และปิดบิล?` : "ปิดโต๊ะนี้ (ไม่มีรายการ)?") &&
                  run(() => api("settleCash", { sessionId: table.session!.id }))
                }
              >
                {data && data.total <= 0 ? "ปิดโต๊ะ" : "💵 รับเงินสด & ปิดบิล"}
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
