"use client";

import { useState } from "react";
import { baht, ItemStatusChip, Sheet, Spinner } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import type { DiningSession, Order, OrderItem, Payment, Table } from "@/lib/types";

type TableCard = Table & { session: DiningSession | null; total: number; waiting: number; toServe: number; pendingPayment: boolean };
type Board = {
  tables: TableCard[];
  payments: (Payment & { label: string; slip_view: string | null })[];
  takeaways: (Order & { total: number; items: OrderItem[] })[];
};

const TA_LABEL: Record<string, { text: string; cls: string }> = {
  awaiting_payment: { text: "รอชำระ", cls: "bg-coral-soft text-red" },
  placed: { text: "กำลังทำ", cls: "bg-gold-soft text-[#8a6418]" },
  ready: { text: "พร้อมรับ", cls: "bg-teal text-white" },
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
    <main className="p-4 grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="grid gap-4 content-start">
        <section>
          <div className="flex items-end justify-between mb-3">
            <h1 className="font-display text-2xl text-teal-deep">ผังโต๊ะ</h1>
            <div className="flex gap-3 text-xs text-muted">
              <span><i className="inline-block h-2.5 w-2.5 rounded-full bg-paper border border-line mr-1" />ว่าง</span>
              <span><i className="inline-block h-2.5 w-2.5 rounded-full bg-mint mr-1" />กำลังทาน</span>
              <span><i className="inline-block h-2.5 w-2.5 rounded-full bg-gold mr-1" />ขอเช็กบิล</span>
            </div>
          </div>
          {(["indoor", "canal"] as const).map((zone) => (
            <div key={zone} className="mb-4">
              <h2 className="text-sm font-semibold text-muted mb-2">{zone === "indoor" ? "🏮 ในร้าน" : "🌙 ริมคลอง"}</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
                {data.tables
                  .filter((t) => t.zone === zone)
                  .map((t) => {
                    const st = t.session?.status;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTableId(t.id)}
                        className={`arch relative border-2 px-2 pt-5 pb-3 text-center transition hover:-translate-y-0.5 ${
                          st === "bill_requested"
                            ? "border-gold bg-gold-soft animate-pulse"
                            : st === "open"
                              ? "border-mint bg-mint-soft"
                              : "border-line bg-paper"
                        }`}
                      >
                        {t.pendingPayment && <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-red ring-2 ring-paper" />}
                        <div className="font-display text-xl text-teal-deep">{t.code}</div>
                        <div className="text-[11px] text-muted">{t.seats} ที่นั่ง</div>
                        {t.session ? (
                          <>
                            <div className="mt-1 font-semibold text-sm">{baht(t.total)}</div>
                            <div className="text-[11px] text-muted">
                              {t.waiting > 0 && `รอ ${t.waiting} `}
                              {t.toServe > 0 && <span className="text-teal-deep font-semibold">เสิร์ฟ {t.toServe}</span>}
                            </div>
                          </>
                        ) : (
                          <div className="mt-1 text-xs text-muted">ว่าง</div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </section>

        <section>
          <h2 className="font-display text-xl text-teal-deep mb-2">🛍 สั่งกลับบ้านวันนี้</h2>
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
          <div className="bg-teal text-white px-4 py-3 flex items-center justify-between">
            <h2 className="font-display text-lg">รอตรวจชำระเงิน</h2>
            <span className="chip bg-gold text-white">{data.payments.length}</span>
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
                  <div className="grid h-24 w-16 shrink-0 place-items-center rounded-lg bg-gold-soft text-3xl">💵</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.label}</div>
                  <div className="font-display text-2xl text-teal-deep">{baht(p.amount)}</div>
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
                      <button className="chip bg-teal text-white py-1" onClick={() => run(() => api("setItemStatus", { itemId: i.id, status: "served" }))}>
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
              <span className="font-display text-2xl text-teal-deep">{baht(data?.total ?? table.total)}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a className="btn btn-ghost text-sm" href={`/liff/table/${table.session.id}`} target="_blank" rel="noreferrer">
                เปิดหน้าลูกค้า
              </a>
              <button
                className="btn btn-gold text-sm"
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
