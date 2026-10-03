"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CartBar, CartLines, MenuBrowser } from "@/components/MenuBrowser";
import { baht, Sheet, TopBar } from "@/components/ui";
import { CartProvider, useCart } from "@/lib/cart";
import { api, useApi } from "@/lib/client";
import type { Order } from "@/lib/types";

export default function TakeawayPage() {
  return (
    <CartProvider scope="takeaway">
      <TopBar title="สั่งกลับบ้าน" back="/liff" />
      <div className="mx-auto max-w-md">
        <div className="mx-4 mt-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand-deep flex gap-2">
          <span>🛍</span>
          <span>ชำระผ่านพร้อมเพย์ก่อน ร้านจะเริ่มทำเมื่อได้รับยอดแล้ว แล้วแจ้งเตือนใน LINE ตอนอาหารพร้อมค่ะ</span>
        </div>
        <MenuBrowser />
      </div>
      <Checkout />
    </CartProvider>
  );
}

function Checkout() {
  const cart = useCart();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: slots } = useApi<string[]>(open ? "pickupSlots" : null);
  const { data: me } = useApi<{ profile: { displayName: string } }>("me");
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- default the name once the LINE profile loads
  useEffect(() => { if (me && !name) setName(me.profile.displayName); }, [me, name]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- default to the earliest pickup slot
  useEffect(() => { if (slots?.length && !slots.includes(time)) setTime(slots[0]); }, [slots, time]);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const order = await api<Order>("placeOrder", { type: "takeaway", name, pickupTime: time, note, lines: cart.toPayload() });
      cart.clear();
      router.push(`/liff/pay/order/${order.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <CartBar label="ไปชำระเงิน" onOpen={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="ตรวจสอบออเดอร์">
        <div className="px-5 pb-6">
          <CartLines />
          <div className="mt-4 grid gap-3">
            <label>
              <span className="text-sm font-semibold">ชื่อผู้รับ</span>
              <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </label>
            <div>
              <span className="text-sm font-semibold">เวลามารับ (วันนี้)</span>
              {slots && slots.length === 0 ? (
                <p className="mt-1 text-sm text-red">วันนี้ร้านปิดรับออเดอร์กลับบ้านแล้วค่ะ</p>
              ) : (
                <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {(slots ?? []).map((s) => (
                    <button
                      key={s}
                      onClick={() => setTime(s)}
                      className={`shrink-0 rounded-xl border px-3 py-2 text-sm tabular-nums ${s === time ? "border-brand bg-brand text-white" : "border-line bg-paper"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label>
              <span className="text-sm font-semibold">หมายเหตุ</span>
              <input className="input mt-1" placeholder="เช่น ขอช้อนส้อม" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
            </label>
          </div>
          {err && <p className="mt-3 rounded-xl bg-peach-soft px-3 py-2 text-sm text-red">{err}</p>}
          <div className="mt-5 flex items-center justify-between text-lg">
            <span>ยอดรวม</span>
            <span className="font-display text-2xl text-brand-deep">{baht(cart.total)}</span>
          </div>
          <button className="btn btn-sun w-full mt-4 text-lg" disabled={busy || !time || !name.trim() || cart.count === 0} onClick={submit}>
            {busy ? "กำลังส่ง…" : "ยืนยัน & ชำระด้วยพร้อมเพย์"}
          </button>
        </div>
      </Sheet>
    </>
  );
}
