"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CartBar, CartLines, MenuBrowser } from "@/components/MenuBrowser";
import { baht, Emblem, ErrorBox, ItemStatusChip, Sheet, Spinner, Toast } from "@/components/ui";
import { CartProvider, useCart } from "@/lib/cart";
import { api, useApi } from "@/lib/client";
import type { DiningSession, OrderItem, Payment, Table } from "@/lib/types";

type View = { session: DiningSession; table: Table; items: OrderItem[]; total: number; payments: Payment[] };

export default function TablePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const view = useApi<View>("session", { sessionId }, { refreshInterval: 4000 });
  const [tab, setTab] = useState<"menu" | "bill">("menu");

  if (view.error) return <div className="mx-auto max-w-md p-6 pt-20"><ErrorBox message={view.error.message} /></div>;
  if (!view.data) return <Spinner />;
  const { table, session, items, total } = view.data;

  if (session.status === "paid") {
    return (
      <main className="mx-auto max-w-md min-h-dvh px-6 flex flex-col items-center justify-center text-center">
        <Emblem size={72} />
        <h1 className="font-display text-2xl text-teal-deep mt-4">ขอบคุณที่มาอุดหนุนค่ะ</h1>
        <p className="text-muted mt-1">โต๊ะ {table.code} ชำระเงินเรียบร้อยแล้ว</p>
        <Link href="/liff" className="btn btn-primary mt-6">กลับหน้าแรก</Link>
      </main>
    );
  }

  return (
    <CartProvider scope={`table:${sessionId}`}>
      <div className="sticky top-0 z-30 bg-teal text-cream">
        <div className="mx-auto max-w-md flex items-center gap-3 px-4 h-14">
          <div className="arch grid h-10 w-9 place-items-center bg-gold text-teal-deep font-display text-sm border-2 border-gold-soft">{table.code}</div>
          <div className="flex-1 leading-tight">
            <div className="font-display">โต๊ะ {table.code}</div>
            <div className="text-[11px] text-mint-soft">{table.zone === "canal" ? "ริมคลอง" : "ในร้าน"} · สั่งเพิ่มได้ตลอด</div>
          </div>
          <div className="flex rounded-full bg-teal-deep p-1 text-sm">
            {(["menu", "bill"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 transition ${tab === t ? "bg-cream text-teal-deep font-semibold" : ""}`}>
                {t === "menu" ? "เมนู" : `บิล ${items.length ? `(${items.filter((i) => i.status !== "cancelled").length})` : ""}`}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-md">
        {tab === "menu" ? (
          <MenuBrowser topOffset={56} />
        ) : (
          <Bill items={items} total={total} sessionId={sessionId} billRequested={session.status === "bill_requested"} onChanged={() => view.mutate()} />
        )}
      </div>
      {tab === "menu" && <SendOrder sessionId={sessionId} onSent={() => { view.mutate(); setTab("bill"); }} />}
    </CartProvider>
  );
}

function SendOrder({ sessionId, onSent }: { sessionId: string; onSent: () => void }) {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api("placeOrder", { type: "dine_in", sessionId, lines: cart.toPayload() });
      cart.clear();
      setOpen(false);
      setToast("ส่งออเดอร์เข้าครัวแล้ว 🔥");
      onSent();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Toast message={toast} onDone={() => setToast(null)} />
      <CartBar label="ดูรายการที่เลือก" onOpen={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="ยืนยันสั่งอาหาร">
        <div className="px-5 pb-6">
          <CartLines />
          {err && <p className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-sm text-red">{err}</p>}
          <button className="btn btn-primary w-full mt-5 text-lg" disabled={busy || cart.count === 0} onClick={send}>
            {busy ? "กำลังส่ง…" : `ส่งเข้าครัว · ${baht(cart.total)}`}
          </button>
          <p className="mt-2 text-center text-xs text-muted">ยังไม่ต้องจ่ายตอนนี้ เช็กบิลตอนอิ่มได้เลยค่ะ</p>
        </div>
      </Sheet>
    </>
  );
}

function Bill({ items, total, sessionId, billRequested, onChanged }: { items: OrderItem[]; total: number; sessionId: string; billRequested: boolean; onChanged: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const checkout = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!billRequested) await api("requestBill", { sessionId });
      onChanged();
      router.push(`/liff/pay/session/${sessionId}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  if (items.length === 0)
    return (
      <div className="px-6 py-20 text-center text-muted">
        <div className="text-5xl">🍽</div>
        <p className="mt-3">ยังไม่มีรายการ เลือกเมนูแล้วส่งเข้าครัวได้เลยค่ะ</p>
      </div>
    );

  return (
    <div className="px-4 pb-16">
      <section className="card mt-4 overflow-hidden">
        <div className="tile-ribbon" />
        <ul className="divide-y divide-line px-4">
          {items.map((i) => (
            <li key={i.id} className={`flex items-center gap-3 py-3 ${i.status === "cancelled" ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">
                  {i.name} <span className="text-muted">x{i.qty}</span>
                </div>
                {(i.options.length > 0 || i.note) && (
                  <div className="text-xs text-muted truncate">{[...i.options.map((o) => o.label), i.note].filter(Boolean).join(" · ")}</div>
                )}
                <div className="mt-1"><ItemStatusChip status={i.status} /></div>
              </div>
              <span className="text-sm font-semibold tabular-nums">{baht(i.unit_price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between bg-sand/60 px-4 py-4">
          <span className="font-semibold">ยอดรวม</span>
          <span className="font-display text-2xl text-teal-deep">{baht(total)}</span>
        </div>
      </section>
      {err && <p className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-sm text-red">{err}</p>}
      <button className="btn btn-gold w-full mt-5 text-lg" disabled={busy || total <= 0} onClick={checkout}>
        {billRequested ? "ไปหน้าชำระเงิน" : "เช็กบิล"}
      </button>
    </div>
  );
}
