"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { baht, ErrorBox, Spinner, TopBar } from "@/components/ui";
import { api, useApi } from "@/lib/client";
import type { Payment } from "@/lib/types";

type PayInfo = { paid: boolean; amount: number; label: string; promptpayId: string; payload: string; pending: Payment | null };

export default function PayPage() {
  const { type, id } = useParams<{ type: "order" | "session"; id: string }>();
  const targetType = type === "session" ? "session" : "order";
  const { data, error, mutate } = useApi<PayInfo>("payInfo", { targetType, targetId: id }, { refreshInterval: 5000 });
  const [qr, setQr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const back = targetType === "session" ? `/liff/table/${id}` : "/liff";

  useEffect(() => {
    if (data?.payload) QRCode.toDataURL(data.payload, { margin: 1, width: 560, color: { dark: "#9e140d", light: "#ffffff" } }).then(setQr);
  }, [data?.payload]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL lifecycle tied to the chosen file
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (data?.paid) {
    return (
      <Done
        title="ชำระเงินเรียบร้อย"
        text={targetType === "order" ? "ร้านกำลังเตรียมอาหารให้ค่ะ" : "ขอบคุณที่มาอุดหนุนนะคะ 🧡"}
        href={targetType === "order" ? `/liff/orders/${id}` : "/liff"}
        cta={targetType === "order" ? "ดูสถานะออเดอร์" : "กลับหน้าแรก"}
      />
    );
  }

  const send = async (method: "promptpay" | "cash") => {
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("targetType", targetType);
    fd.set("targetId", id);
    fd.set("method", method);
    if (method === "promptpay" && file) fd.set("slip", file);
    try {
      await api("submitPayment", fd);
      setFile(null);
      await mutate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title="ชำระเงิน" back={back} />
      <main className="mx-auto max-w-md px-4 pb-16">
        {error && <div className="mt-4"><ErrorBox message={error.message} onRetry={() => mutate()} /></div>}
        {!data && !error && <Spinner />}
        {data && !data.paid && (
          <>
            <section className="card mt-4 overflow-hidden text-center">
              <div className="pattern-ribbon" />
              <div className="px-5 pt-4 pb-5">
                <p className="text-sm text-muted">{data.label}</p>
                <p className="font-display text-4xl text-brand-deep mt-1">{baht(data.amount)}</p>
                <div className="mx-auto mt-4 w-60 rounded-3xl border-4 border-[#113566] bg-white p-3">
                  <div className="rounded-xl bg-[#113566] py-1.5 text-xs font-bold tracking-wider text-white">PromptPay · พร้อมเพย์</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {qr ? <img src={qr} alt="QR พร้อมเพย์" className="mt-2 w-full" /> : <div className="aspect-square" />}
                </div>
                <p className="mt-3 text-xs text-muted">
                  พร้อมเพย์ {data.promptpayId} · สแกนด้วยแอปธนาคารใดก็ได้
                  <br />
                  (กดค้างที่รูป QR เพื่อบันทึกลงเครื่อง)
                </p>
              </div>
            </section>

            {data.pending ? (
              <section className="card mt-4 p-5 text-center animate-pop">
                <div className="text-4xl">⏳</div>
                <h2 className="font-display text-lg text-brand-deep mt-2">
                  {data.pending.method === "cash" ? "แจ้งพนักงานแล้ว รอรับเงินสดที่โต๊ะ" : "ส่งสลิปแล้ว รอร้านตรวจสอบ"}
                </h2>
                <p className="text-sm text-muted mt-1">หน้านี้จะอัปเดตอัตโนมัติเมื่อร้านยืนยัน</p>
                <button className="btn btn-ghost mt-4 text-sm" onClick={() => fileInput.current?.click()}>
                  ส่งสลิปใหม่
                </button>
              </section>
            ) : (
              <section className="card mt-4 p-5">
                <h2 className="font-semibold">โอนแล้ว? แนบสลิปตรงนี้</h2>
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="สลิป" className="mt-3 max-h-72 mx-auto rounded-2xl border border-line" />
                ) : (
                  <button
                    onClick={() => fileInput.current?.click()}
                    className="mt-3 w-full rounded-2xl border-2 border-dashed border-brand-light py-8 text-brand bg-brand-soft/40"
                  >
                    <div className="text-3xl">🧾</div>
                    <div className="text-sm font-semibold mt-1">เลือกรูปสลิป</div>
                  </button>
                )}
                {preview && (
                  <button className="mt-2 text-sm text-brand underline" onClick={() => fileInput.current?.click()}>
                    เปลี่ยนรูป
                  </button>
                )}
                <button className="btn btn-primary w-full mt-4" disabled={!file || busy} onClick={() => send("promptpay")}>
                  {busy ? "กำลังส่ง…" : "ส่งสลิป"}
                </button>
                {targetType === "session" && (
                  <button className="btn btn-ghost w-full mt-2" disabled={busy} onClick={() => send("cash")}>
                    💵 จ่ายเงินสดกับพนักงาน
                  </button>
                )}
              </section>
            )}
            {err && <p className="mt-3 rounded-xl bg-peach-soft px-3 py-2 text-sm text-red">{err}</p>}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            {data.pending && file && (
              <button className="btn btn-primary w-full mt-3" disabled={busy} onClick={() => send("promptpay")}>
                ส่งสลิปใหม่นี้
              </button>
            )}
          </>
        )}
      </main>
    </>
  );
}

function Done({ title, text, href, cta }: { title: string; text: string; href: string; cta: string }) {
  return (
    <main className="mx-auto max-w-md min-h-dvh px-6 flex flex-col items-center justify-center text-center">
      <div className="arch pattern-bg h-40 w-32 grid place-items-center border-4 border-sun animate-pop">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand text-3xl text-white shadow-lg">✓</span>
      </div>
      <h1 className="font-display text-2xl text-brand-deep mt-6">{title}</h1>
      <p className="text-muted mt-1">{text}</p>
      <Link href={href} className="btn btn-primary mt-6">
        {cta}
      </Link>
    </main>
  );
}
