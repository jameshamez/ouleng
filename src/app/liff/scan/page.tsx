"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TopBar } from "@/components/ui";
import { getLiff, lineMode } from "@/lib/client";

export default function ScanPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  const scan = async () => {
    setErr(null);
    try {
      const liff = await getLiff();
      const { value } = await liff.scanCodeV2();
      if (!value) return;
      // Table QRs are LIFF URLs: https://liff.line.me/<id>/t/<code>/<key>
      const m = value.match(/\/t\/([^/]+)\/([^/?#]+)/);
      if (!m) throw new Error("QR นี้ไม่ใช่ QR โต๊ะของร้าน");
      router.push(`/liff/t/${m[1]}/${m[2]}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <>
      <TopBar title="สั่งที่โต๊ะ" back="/liff" />
      <main className="mx-auto max-w-md px-6 pt-10 text-center">
        <div className="arch pattern-bg mx-auto h-56 w-44 border-4 border-sun grid place-items-center">
          <div className="rounded-2xl bg-paper p-3 shadow-lg text-5xl">📱</div>
        </div>
        <h1 className="font-display text-2xl text-brand-deep mt-6">สแกน QR บนโต๊ะ</h1>
        <p className="text-muted mt-2 text-sm">ทุกคนในโต๊ะสแกนแล้วสั่งเข้าบิลเดียวกันได้เลย สั่งเพิ่มได้ตลอด แล้วค่อยเช็กบิลตอนอิ่ม</p>
        {lineMode ? (
          <button className="btn btn-primary mt-6 w-full text-lg" onClick={scan}>
            📷 เปิดกล้องสแกน
          </button>
        ) : (
          <div className="mt-6 rounded-2xl bg-sun-soft p-4 text-sm text-sun-ink">
            โหมดเดโม: ยังไม่ได้ต่อ LINE จึงเปิดกล้องไม่ได้
            <br />
            <Link href="/" className="underline font-semibold">ไปที่หน้าเดโมเพื่อเลือกโต๊ะ</Link>
          </div>
        )}
        {err && <p className="mt-3 rounded-xl bg-peach-soft px-3 py-2 text-sm text-red">{err}</p>}
        <p className="mt-6 text-xs text-muted">หรือใช้กล้องมือถือสแกน QR ที่โต๊ะได้โดยตรง</p>
      </main>
    </>
  );
}
