"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { ItemStatus, MenuItem } from "@/lib/types";

/** The shop's mascot (cropped from the logo) in a round badge. */
export function Emblem({ size = 44 }: { size?: number }) {
  return (
    <span
      className="inline-block shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-brand-light"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-face.png" alt="" className="h-full w-full object-cover" />
    </span>
  );
}

export function Brand({ sub }: { sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Emblem />
      <div className="leading-tight whitespace-nowrap">
        <div className="font-display text-lg text-brand">อูเล้งคาเฟ่</div>
        <div className="text-[11px] text-muted">{sub ?? "นมสด · โกปี้ · ปาท่องโก๋ภูเก็ต"}</div>
      </div>
    </div>
  );
}

export function TopBar({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 bg-brand text-white shadow-md">
      <div className="mx-auto max-w-md flex items-center gap-2 px-4 h-14">
        {back && (
          <Link href={back} className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-white/15" aria-label="ย้อนกลับ">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
        )}
        <h1 className="font-display text-lg text-white flex-1 truncate">{title}</h1>
        {right}
      </div>
    </div>
  );
}

const STATION_TINT = {
  somtam: "from-brand-soft to-[#f9cdc4]",
  cafe: "from-peach-soft to-sun-soft",
};

/** Food visual: photo when the shop uploaded one, otherwise a tiled emoji plate. */
export function FoodArt({ item, className = "" }: { item: Pick<MenuItem, "emoji" | "image_url" | "station" | "name">; className?: string }) {
  if (item.image_url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.image_url} alt={item.name} className={`object-cover ${className}`} />;
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${STATION_TINT[item.station]} ${className}`} style={{ containerType: "inline-size" }}>
      <div className="absolute -right-3 -top-3 h-10 w-10 rounded-full opacity-60 pattern-bg" />
      <div className="absolute inset-0 grid place-items-center">
        <span className="drop-shadow-sm" style={{ fontSize: "min(5rem, 45cqw)" }}>
          {item.emoji}
        </span>
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal>
      <button className="absolute inset-0 bg-ink/40 animate-fade" onClick={onClose} aria-label="ปิด" />
      <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-[28px] bg-paper animate-sheet pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur pt-2.5 pb-1 rounded-t-[28px]">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
          {title && <h2 className="font-display text-lg text-brand-deep px-5 pt-3">{title}</h2>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-paper">
      <button className="h-9 w-9 grid place-items-center text-xl text-brand disabled:opacity-30" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="ลด">
        −
      </button>
      <span className="w-7 text-center font-semibold tabular-nums">{value}</span>
      <button className="h-9 w-9 grid place-items-center text-xl text-brand" onClick={() => onChange(value + 1)} aria-label="เพิ่ม">
        +
      </button>
    </div>
  );
}

export function Spinner({ label = "กำลังโหลด…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <div className="h-9 w-9 rounded-full border-[3px] border-brand-soft border-t-brand animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card p-5 text-center">
      <div className="text-3xl mb-2">🥲</div>
      <p className="text-sm text-ink">{message}</p>
      {onRetry && (
        <button className="btn btn-ghost mt-4 text-sm" onClick={onRetry}>
          ลองใหม่
        </button>
      )}
    </div>
  );
}

const ITEM_STATUS: Record<ItemStatus, { label: string; cls: string }> = {
  held: { label: "รอชำระ/ยืนยัน", cls: "bg-sand text-muted" },
  queued: { label: "รับออเดอร์แล้ว", cls: "bg-sun-soft text-sun-ink" },
  cooking: { label: "กำลังทำ", cls: "bg-peach-soft text-red" },
  ready: { label: "พร้อมเสิร์ฟ", cls: "bg-brand-soft text-brand-deep" },
  served: { label: "เสิร์ฟแล้ว", cls: "bg-brand text-white" },
  cancelled: { label: "ยกเลิก", cls: "bg-line text-muted line-through" },
};

export function ItemStatusChip({ status }: { status: ItemStatus }) {
  const s = ITEM_STATUS[status];
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

export const baht = (n: number) => `฿${Number(n).toLocaleString("th-TH")}`;

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4 pointer-events-none">
      <div className="animate-pop rounded-full bg-ink text-white px-4 py-2.5 text-sm shadow-lg">{message}</div>
    </div>
  );
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
export function thaiDate(iso: string, withDay = false) {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${withDay ? TH_DAYS[day] + " " : ""}${d} ${TH_MONTHS[m - 1]} ${String(y + 543).slice(2)}`;
}
