"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ErrorBox, Spinner, thaiDate, TopBar } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import type { Booking } from "@/lib/types";

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, error, mutate } = useApi<{ bookings: Booking[] }>("me", undefined, { refreshInterval: 8000 });
  const [busy, setBusy] = useState(false);
  const b = data?.bookings.find((x) => x.id === id);

  const cancel = async () => {
    if (!confirm("ยกเลิกการจองนี้?")) return;
    setBusy(true);
    try {
      await api("cancelBooking", { id });
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="การจองของฉัน" back="/liff" />
      <main className="mx-auto max-w-md px-4 pb-16">
        {error && <div className="mt-4"><ErrorBox message={error.message} /></div>}
        {!data && !error && <Spinner />}
        {data && !b && (
          <div className="mt-10 text-center text-muted">
            <p>การจองนี้ถูกยกเลิกหรือผ่านไปแล้วค่ะ</p>
            <Link href="/liff" className="btn btn-primary mt-4">กลับหน้าแรก</Link>
          </div>
        )}
        {b && (
          <section className="mt-6 text-center">
            <div className="arch mx-auto w-64 bg-brand text-cream px-6 pt-10 pb-7 border-4 border-sun shadow-xl animate-pop">
              <div className="text-xs tracking-widest text-sun-soft">อูเล้งคาเฟ่ · RESERVATION</div>
              <div className="font-display text-3xl mt-3">{b.time} น.</div>
              <div className="mt-1">{thaiDate(b.date, true)}</div>
              <div className="my-4 h-px bg-sun/50" />
              <div className="text-sm">คุณ{b.name}</div>
              <div className="text-sm text-brand-soft">{b.party_size} ท่าน · {b.zone === "canal" ? "ริมคลอง" : "ในร้าน"}</div>
            </div>
            <div className="mt-5">
              {b.status === "confirmed" ? (
                <span className="chip bg-brand-soft text-brand-deep text-sm px-4 py-1.5">✓ ร้านยืนยันแล้ว</span>
              ) : (
                <span className="chip bg-sun-soft text-sun-ink text-sm px-4 py-1.5">⏳ รอร้านยืนยัน · จะแจ้งทาง LINE</span>
              )}
            </div>
            {b.note && <p className="mt-3 text-sm text-muted">หมายเหตุ: {b.note}</p>}
            <div className="mt-8 grid gap-2">
              <Link href="/liff" className="btn btn-primary">กลับหน้าแรก</Link>
              <button className="btn btn-danger" disabled={busy} onClick={cancel}>ยกเลิกการจอง</button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
