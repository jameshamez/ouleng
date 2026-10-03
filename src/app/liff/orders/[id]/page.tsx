"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { baht, ErrorBox, ItemStatusChip, Spinner, TopBar } from "@/components/ui";
import { useApi } from "@/lib/client";
import type { Order, OrderItem } from "@/lib/types";

type View = { order: Order; items: OrderItem[]; total: number };

const STEPS = [
  { key: "awaiting_payment", label: "ชำระเงิน", icon: "💳" },
  { key: "placed", label: "กำลังทำ", icon: "🔥" },
  { key: "ready", label: "พร้อมรับ", icon: "🛍" },
  { key: "picked_up", label: "รับแล้ว", icon: "🧡" },
];

export default function OrderStatus() {
  const { id } = useParams<{ id: string }>();
  const { data, error, mutate } = useApi<View>("order", { orderId: id }, { refreshInterval: 4000 });
  const step = data ? STEPS.findIndex((s) => s.key === data.order.status) : -1;

  return (
    <>
      <TopBar title="สถานะออเดอร์" back="/liff" />
      <main className="mx-auto max-w-md px-4 pb-16">
        {error && <div className="mt-4"><ErrorBox message={error.message} onRetry={() => mutate()} /></div>}
        {!data && !error && <Spinner />}
        {data && (
          <>
            <section className="card mt-4 p-5 text-center">
              <p className="text-sm text-muted">สั่งกลับบ้าน · คุณ{data.order.customer_name}</p>
              <p className="font-display text-3xl text-brand-deep mt-1">รับ {data.order.pickup_time} น.</p>
              <div className="mt-5 flex items-start">
                {STEPS.map((s, i) => (
                  <div key={s.key} className="flex-1 flex flex-col items-center relative">
                    {i > 0 && <div className={`absolute right-1/2 top-5 h-1 w-full -z-0 ${i <= step ? "bg-brand" : "bg-line"}`} />}
                    <div
                      className={`relative z-10 grid h-10 w-10 place-items-center rounded-full text-lg transition ${
                        i < step ? "bg-brand text-white" : i === step ? "bg-sun text-brand-deep ring-4 ring-sun-soft animate-pulse" : "bg-sand"
                      }`}
                    >
                      {i < step ? "✓" : s.icon}
                    </div>
                    <span className={`mt-1.5 text-xs ${i === step ? "font-semibold text-brand-deep" : "text-muted"}`}>{s.label}</span>
                  </div>
                ))}
              </div>
              {data.order.status === "ready" && (
                <p className="mt-5 rounded-2xl bg-brand-soft py-3 text-brand-deep font-semibold animate-pop">อาหารพร้อมแล้ว แวะรับที่เคาน์เตอร์ได้เลยค่ะ 🎉</p>
              )}
              {data.order.status === "awaiting_payment" && (
                <Link href={`/liff/pay/order/${id}`} className="btn btn-sun mt-5 w-full">
                  ไปชำระเงิน
                </Link>
              )}
            </section>

            <section className="card mt-4 p-4">
              <h2 className="font-semibold mb-1">รายการ</h2>
              <ul className="divide-y divide-line">
                {data.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {i.name} <span className="text-muted">x{i.qty}</span>
                      </div>
                      {i.options.length > 0 && <div className="text-xs text-muted truncate">{i.options.map((o) => o.label).join(" · ")}</div>}
                    </div>
                    <ItemStatusChip status={i.status} />
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t border-line pt-3 font-semibold">
                <span>รวม</span>
                <span className="text-brand-deep">{baht(data.total)}</span>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
