"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CartBar, CartLines, MenuBrowser } from "@/components/MenuBrowser";
import { baht, Stepper, thaiDate, TopBar } from "@/components/ui";
import { CartProvider, useCart } from "@/lib/cart";
import { api, useApi } from "@/lib/client";
import type { Booking, Zone } from "@/lib/types";

const ZONES: { id: Zone; label: string; sub: string; icon: string }[] = [
  { id: "indoor", label: "ในร้าน", sub: "บรรยากาศตลาดภูเก็ต", icon: "🏮" },
  { id: "canal", label: "ริมคลอง", sub: "ดนตรีสด · หนังกลางแปลง", icon: "🌙" },
];

function nextDays(n: number) {
  const out: string[] = [];
  const now = new Date(Date.now() + 7 * 3600_000); // shift to Bangkok, read as UTC
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getTime() + i * 86400_000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function BookPage() {
  return (
    <CartProvider scope="booking">
      <BookFlow />
    </CartProvider>
  );
}

function BookFlow() {
  const router = useRouter();
  const cart = useCart();
  const days = useMemo(() => nextDays(14), []);
  const [step, setStep] = useState<"when" | "who" | "menu">("when");
  const [zone, setZone] = useState<Zone>("canal");
  const [party, setParty] = useState(2);
  const [date, setDate] = useState(days[0]);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: slots, isLoading } = useApi<{ time: string; left: number }[]>("availability", { date, partySize: party, zone });
  const { data: me } = useApi<{ profile: { displayName: string } }>("me");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- prefill from LINE profile
  useEffect(() => { if (me && !name) setName(me.profile.displayName); }, [me, name]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- drop a chosen time that just became unavailable
  useEffect(() => { if (time && slots && !slots.find((s) => s.time === time && s.left > 0)) setTime(null); }, [slots, time]);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const b = await api<Booking>("createBooking", { name, phone, partySize: party, date, time, zone, note, preorder: cart.toPayload() });
      cart.clear();
      router.replace(`/liff/bookings/${b.id}?new=1`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  if (step === "menu") {
    return (
      <>
        <TopBar title="สั่งอาหารล่วงหน้า" right={<button className="text-sm text-teal font-semibold" onClick={() => setStep("who")}>เสร็จ</button>} />
        <div className="mx-auto max-w-md">
          <p className="mx-4 mt-3 rounded-2xl bg-gold-soft px-4 py-3 text-sm text-[#7a5612]">ร้านจะเริ่มทำเมื่อคุณมาถึงร้าน ชำระเงินตอนเช็กบิลพร้อมกันค่ะ</p>
          <MenuBrowser />
        </div>
        <CartBar label="เสร็จแล้ว กลับไปยืนยันการจอง" onOpen={() => setStep("who")} />
      </>
    );
  }

  return (
    <>
      <TopBar title="จองโต๊ะ" back={step === "who" ? undefined : "/liff"} right={step === "who" ? <button className="text-sm text-teal" onClick={() => setStep("when")}>‹ แก้ไขเวลา</button> : undefined} />
      <main className="mx-auto max-w-md px-4 pb-32">
        {step === "when" && (
          <>
            <section className="mt-4 grid grid-cols-2 gap-3">
              {ZONES.map((z) => (
                <button
                  key={z.id}
                  onClick={() => setZone(z.id)}
                  className={`arch border-2 px-3 pt-7 pb-4 text-center transition ${zone === z.id ? "border-teal bg-mint-soft shadow-md" : "border-line bg-paper"}`}
                >
                  <div className="text-3xl">{z.icon}</div>
                  <div className="font-display text-teal-deep mt-1">{z.label}</div>
                  <div className="text-[11px] text-muted">{z.sub}</div>
                </button>
              ))}
            </section>

            <section className="card mt-4 flex items-center justify-between p-4">
              <div>
                <div className="font-semibold">จำนวนคน</div>
                <div className="text-xs text-muted">มากกว่า 8 ท่าน โทรสอบถามร้านได้เลย</div>
              </div>
              <Stepper value={party} onChange={(n) => setParty(Math.min(8, Math.max(1, n)))} min={1} />
            </section>

            <section className="mt-5">
              <h2 className="font-semibold mb-2">วันที่</h2>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {days.map((d, i) => {
                  const [dayName, ...rest] = thaiDate(d, true).split(" ");
                  return (
                    <button
                      key={d}
                      onClick={() => setDate(d)}
                      className={`shrink-0 w-16 rounded-2xl border py-2 text-center transition ${d === date ? "border-teal bg-teal text-white shadow" : "border-line bg-paper"}`}
                    >
                      <div className="text-[11px] opacity-80">{i === 0 ? "วันนี้" : i === 1 ? "พรุ่งนี้" : dayName}</div>
                      <div className="font-display text-xl leading-tight">{rest[0]}</div>
                      <div className="text-[11px] opacity-80">{rest[1]}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-5">
              <h2 className="font-semibold mb-2">เวลา</h2>
              {isLoading && <p className="text-sm text-muted">กำลังเช็กโต๊ะว่าง…</p>}
              {slots && slots.every((s) => s.left < 1) && (
                <p className="mb-2 rounded-xl bg-gold-soft px-3 py-2 text-sm text-[#7a5612]">วันนี้ไม่มีรอบว่างแล้ว ลองเลือกวันอื่นนะคะ</p>
              )}
              <div className="grid grid-cols-4 gap-2">
                {(slots ?? []).map((s) => (
                  <button
                    key={s.time}
                    disabled={s.left < 1}
                    onClick={() => setTime(s.time)}
                    className={`rounded-xl border py-2.5 text-sm tabular-nums transition disabled:opacity-35 disabled:line-through ${
                      s.time === time ? "border-teal bg-teal text-white shadow" : "border-line bg-paper"
                    }`}
                  >
                    {s.time}
                    {s.left > 0 && s.left <= 2 && s.time !== time && <span className="block text-[10px] text-coral">เหลือ {s.left}</span>}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {step === "who" && (
          <>
            <section className="card mt-4 p-4 flex items-center gap-4">
              <div className="arch tile-bg h-16 w-14 shrink-0 border-2 border-gold" />
              <div>
                <div className="font-display text-lg text-teal-deep">{thaiDate(date, true)} · {time} น.</div>
                <div className="text-sm text-muted">{party} ท่าน · {zone === "canal" ? "ริมคลอง" : "ในร้าน"} · นั่งได้ 2 ชม.</div>
              </div>
            </section>

            <section className="mt-4 grid gap-3">
              <label>
                <span className="text-sm font-semibold">ชื่อผู้จอง</span>
                <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              </label>
              <label>
                <span className="text-sm font-semibold">เบอร์โทร</span>
                <input className="input mt-1" inputMode="tel" placeholder="08x-xxx-xxxx" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={12} />
              </label>
              <label>
                <span className="text-sm font-semibold">หมายเหตุ</span>
                <input className="input mt-1" placeholder="เช่น วันเกิด, มีเด็กเล็ก, ขอโต๊ะใกล้เวที" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
              </label>
            </section>

            <section className="card mt-4 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">สั่งอาหารล่วงหน้า</div>
                  <div className="text-xs text-muted">ไม่บังคับ · มาถึงแล้วได้ทานเร็วขึ้น</div>
                </div>
                <button className="btn btn-ghost text-sm py-2" onClick={() => setStep("menu")}>
                  {cart.count ? "แก้ไข" : "+ เลือกเมนู"}
                </button>
              </div>
              {cart.count > 0 && (
                <div className="mt-2">
                  <CartLines />
                  <div className="text-right text-sm font-semibold text-teal-deep">ประมาณ {baht(cart.total)}</div>
                </div>
              )}
            </section>
            {err && <p className="mt-3 rounded-xl bg-coral-soft px-3 py-2 text-sm text-red">{err}</p>}
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 backdrop-blur px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          {step === "when" ? (
            <button className="btn btn-primary w-full text-lg" disabled={!time} onClick={() => setStep("who")}>
              {time ? `ถัดไป · ${time} น.` : "เลือกเวลา"}
            </button>
          ) : (
            <button className="btn btn-gold w-full text-lg" disabled={busy || !name.trim() || phone.replace(/\D/g, "").length < 9} onClick={submit}>
              {busy ? "กำลังจอง…" : "ยืนยันการจอง"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
