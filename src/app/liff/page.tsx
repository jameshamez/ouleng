"use client";

import Link from "next/link";
import { useApi } from "@/lib/client";
import type { Booking, MenuItem, Order } from "@/lib/types";
import { baht, FoodArt, thaiDate } from "@/components/ui";

type Me = { profile: { displayName: string; pictureUrl: string | null }; bookings: (Booking & { table_code: string | null })[]; takeaways: Order[] };

const ORDER_LABEL: Record<string, string> = {
  awaiting_payment: "รอชำระเงิน",
  placed: "กำลังเตรียม",
  ready: "พร้อมรับแล้ว!",
};

export default function LiffHome() {
  const { data: me } = useApi<Me>("me", undefined, { refreshInterval: 10_000 });
  const { data: menu } = useApi<{ items: MenuItem[] }>("menu");
  const signature = (menu?.items ?? []).filter((i) => i.is_signature).slice(0, 6);

  return (
    <main className="mx-auto max-w-md pb-16">
      {/* Hero: shophouse arch over tile wall */}
      {/* Hero in the style of the shop's posters: red wall, logo tab, yellow headline */}
      <header className="pattern-bg relative px-5 pb-24 rounded-b-[36px] overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="rounded-b-[28px] bg-white px-2.5 pt-2 pb-1.5 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="อูเล้งคาเฟ่" className="h-24 w-24 object-contain" />
          </div>
          <span className="chip mt-4 bg-sun text-brand-deep px-3 py-1">เปิดทุกวัน 12:00–24:00</span>
        </div>
        <p className="mt-5 text-sm text-white/85">อูเล้งคาเฟ่ ✕ บันเทิงเริงตำ</p>
        <h1 className="poster-title text-[44px] mt-1">
          สวัสดีค่ะ
          <br />
          <span className="text-white">คุณ{me?.profile.displayName ?? "…"}</span>
        </h1>
        <p className="mt-3 text-sm text-white/90">นมสด · โกปี้ · ปาท่องโก๋ภูเก็ต · ส้มตำแซ่บๆ</p>
      </header>

      {/* Main actions */}
      <section className="-mt-16 relative z-10 px-4 grid grid-cols-2 gap-3">
        <Link href="/liff/book" className="card col-span-2 flex items-center gap-4 p-4 active:scale-[0.99] transition">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-peach-soft text-3xl">🪑</div>
          <div className="flex-1">
            <div className="font-display text-lg text-brand-deep">จองโต๊ะ</div>
            <div className="text-xs text-muted">ในร้าน หรือ ริมคลองฟังดนตรีสด</div>
          </div>
          <span className="text-brand text-xl">›</span>
        </Link>
        <Link href="/liff/takeaway" className="card p-4 active:scale-[0.99] transition">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-2xl">🛍</div>
          <div className="font-display text-brand-deep mt-3">สั่งกลับบ้าน</div>
          <div className="text-xs text-muted">จ่ายก่อน มารับได้เลย</div>
        </Link>
        <Link href="/liff/scan" className="card p-4 active:scale-[0.99] transition">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sun-soft text-2xl">📷</div>
          <div className="font-display text-brand-deep mt-3">สั่งที่โต๊ะ</div>
          <div className="text-xs text-muted">สแกน QR บนโต๊ะ</div>
        </Link>
      </section>

      {/* Live activity */}
      {me && (me.bookings.length > 0 || me.takeaways.length > 0) && (
        <section className="px-4 mt-6">
          <h2 className="font-display text-brand-deep mb-2">รายการของฉัน</h2>
          <div className="grid gap-2.5">
            {me.takeaways.map((o) => (
              <Link
                key={o.id}
                href={o.status === "awaiting_payment" ? `/liff/pay/order/${o.id}` : `/liff/orders/${o.id}`}
                className="card flex items-center gap-3 p-3.5"
              >
                <span className="text-2xl">🛍</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm">สั่งกลับบ้าน · รับ {o.pickup_time} น.</div>
                  <div className="text-xs text-muted">{ORDER_LABEL[o.status] ?? o.status}</div>
                </div>
                <span className={`chip ${o.status === "ready" ? "bg-brand text-white" : o.status === "awaiting_payment" ? "bg-peach-soft text-red" : "bg-sun-soft text-sun-ink"}`}>
                  {o.status === "awaiting_payment" ? "จ่ายเงิน" : "ดูสถานะ"}
                </span>
              </Link>
            ))}
            {me.bookings.map((b) => (
              <Link key={b.id} href={`/liff/bookings/${b.id}`} className="card flex items-center gap-3 p-3.5">
                <span className="text-2xl">📅</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm">
                    {thaiDate(b.date, true)} · {b.time} น. · {b.party_size} ท่าน
                  </div>
                  <div className="text-xs text-muted">{b.table_code ? `โต๊ะ ${b.table_code} · ` : ""}{b.zone === "canal" ? "ริมคลอง" : "ในร้าน"}</div>
                </div>
                <span className={`chip ${b.status === "confirmed" ? "bg-brand-soft text-brand-deep" : "bg-sun-soft text-sun-ink"}`}>
                  {b.status === "confirmed" ? "ยืนยันแล้ว" : "รอร้านยืนยัน"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Signature dishes */}
      {signature.length > 0 && (
        <section className="mt-7">
          <div className="pattern-ribbon" />
          <div className="px-4 pt-5">
            <h2 className="font-display text-xl text-brand-deep">เมนูที่ต้องลอง</h2>
            <p className="text-xs text-muted">คัดมาจากรีวิวของลูกค้าจริง</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 px-4">
            {signature.map((i) => (
              <Link key={i.id} href="/liff/takeaway" className="text-center">
                <FoodArt item={i} className="arch aspect-[3/4] w-full border-2 border-sun/30" />
                <div className="mt-1.5 text-xs font-semibold leading-snug line-clamp-2">{i.name}</div>
                <div className="text-xs text-brand">{baht(i.price)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-10 px-6 text-center text-xs text-muted leading-relaxed">
        63 หมู่ 4 ซ.แก้วอินทร์ ต.บางแม่นาง อ.บางใหญ่ นนทบุรี
        <br />
        โทร <a className="text-brand underline" href="tel:0836544414">083-654-4414</a> · LINE @oulengcafe
        <br />
        ครัวปิด 23:30 น. · มีที่จอดรถ
      </footer>
    </main>
  );
}
