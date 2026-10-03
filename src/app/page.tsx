import Link from "next/link";
import { connection } from "next/server";
import { Emblem } from "@/components/ui";
import { isSupabase } from "@/lib/db";
import { lineLive } from "@/lib/line";
import { tableQrs } from "@/lib/service";

// Entry hub: shortcuts to the customer (LINE) side, staff screens and table QRs.
export default async function Home() {
  await connection();
  // Table links carry each table's secret key, so only list them in demo mode.
  const tables = lineLive ? [] : await tableQrs();

  return (
    <main className="min-h-dvh tile-bg px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="arch mx-auto max-w-md bg-teal text-cream text-center px-8 pt-12 pb-8 border-4 border-gold shadow-2xl">
          <div className="flex justify-center"><Emblem size={64} /></div>
          <h1 className="font-display text-3xl mt-3">อูเล้งคาเฟ่</h1>
          <p className="text-mint-soft text-sm mt-1">ระบบจองโต๊ะ & สั่งอาหารผ่าน LINE</p>
          <div className="mt-4 flex justify-center gap-2 text-[11px]">
            <span className={`chip ${lineLive ? "bg-[#06c755] text-white" : "bg-gold-soft text-[#7a5612]"}`}>
              LINE: {lineLive ? "เชื่อมต่อแล้ว" : "โหมดจำลอง"}
            </span>
            <span className={`chip ${isSupabase ? "bg-[#3ecf8e] text-white" : "bg-gold-soft text-[#7a5612]"}`}>
              DB: {isSupabase ? "Supabase" : "ไฟล์เดโม"}
            </span>
          </div>
        </header>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="card p-5">
            <h2 className="font-display text-xl text-teal-deep">📱 ฝั่งลูกค้า (ใน LINE)</h2>
            <p className="text-sm text-muted mt-1">หน้าที่เปิดจาก Rich Menu ของ LINE OA ร้าน</p>
            <div className="mt-4 grid gap-2">
              <Link className="btn btn-primary" href="/liff">หน้าแรกลูกค้า</Link>
              <div className="grid grid-cols-2 gap-2">
                <Link className="btn btn-ghost text-sm" href="/liff/book">🪑 จองโต๊ะ</Link>
                <Link className="btn btn-ghost text-sm" href="/liff/takeaway">🛍 กลับบ้าน</Link>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-xl text-teal-deep">🧑‍🍳 ฝั่งร้าน</h2>
            <p className="text-sm text-muted mt-1">เปิดบนแท็บเล็ต/คอมที่ร้าน · เข้าด้วย PIN</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link className="btn btn-ghost text-sm" href="/staff/kitchen">🔥 จอครัว</Link>
              <Link className="btn btn-ghost text-sm" href="/staff/cashier">💰 แคชเชียร์</Link>
              <Link className="btn btn-ghost text-sm" href="/staff/bookings">📅 การจอง</Link>
              <Link className="btn btn-ghost text-sm" href="/staff/admin">⚙️ จัดการร้าน</Link>
            </div>
            {!lineLive && <p className="mt-3 text-[11px] text-muted">PIN เดโม: ส้มตำ 1111 · คาเฟ่ 2222 · แคชเชียร์ 3333 · แอดมิน 9999</p>}
          </section>
        </div>

        {tables.length > 0 && <section className="card mt-4 p-5">
          <h2 className="font-display text-xl text-teal-deep">🔳 จำลองสแกน QR ที่โต๊ะ</h2>
          <p className="text-sm text-muted mt-1">กดเลขโต๊ะ = ลูกค้าสแกน QR บนโต๊ะนั้น</p>
          <div className="mt-4 grid grid-cols-4 sm:grid-cols-8 gap-2">
            {tables.map((t) => (
              <Link key={t.id} href={t.path} className={`arch border-2 pt-4 pb-2 text-center font-display hover:-translate-y-0.5 transition ${t.zone === "canal" ? "border-mint bg-mint-soft" : "border-gold bg-gold-soft"}`}>
                {t.code}
              </Link>
            ))}
          </div>
        </section>}
      </div>
    </main>
  );
}
