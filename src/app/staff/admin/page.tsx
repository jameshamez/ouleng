"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { FloorEditor } from "@/components/FloorEditor";
import { baht, Emblem, FoodArt, Spinner } from "@/components/ui";
import { api, LIFF_ID, useApi } from "@/lib/client";
import type { MenuCategory, MenuItem, Table } from "@/lib/types";

type Sales = { total: number; count: number; promptpay: number; cash: number };

export default function AdminPage() {
  const [tab, setTab] = useState<"menu" | "floor" | "qr">("menu");
  const { data: sales } = useApi<Sales>("sales", undefined, { refreshInterval: 15_000 });

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <section className="no-print grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "ยอดขายวันนี้", value: sales ? baht(sales.total) : "…", big: true },
          { label: "จำนวนบิล", value: sales?.count ?? "…" },
          { label: "พร้อมเพย์", value: sales ? baht(sales.promptpay) : "…" },
          { label: "เงินสด", value: sales ? baht(sales.cash) : "…" },
        ].map((k) => (
          <div key={k.label} className={`card p-4 ${k.big ? "bg-brand text-white border-brand" : ""}`}>
            <div className={`text-xs ${k.big ? "text-brand-soft" : "text-muted"}`}>{k.label}</div>
            <div className="font-display text-2xl mt-1">{k.value}</div>
          </div>
        ))}
      </section>

      <div className="no-print mt-6 flex gap-2">
        <button onClick={() => setTab("menu")} className={`rounded-full px-4 py-2 text-sm ${tab === "menu" ? "bg-brand text-white" : "bg-paper border border-line"}`}>
          🍽 จัดการเมนู
        </button>
        <button onClick={() => setTab("floor")} className={`rounded-full px-4 py-2 text-sm ${tab === "floor" ? "bg-brand text-white" : "bg-paper border border-line"}`}>
          🗺 ผังร้าน
        </button>
        <button onClick={() => setTab("qr")} className={`rounded-full px-4 py-2 text-sm ${tab === "qr" ? "bg-brand text-white" : "bg-paper border border-line"}`}>
          🔳 QR ประจำโต๊ะ
        </button>
      </div>

      {tab === "menu" ? <MenuEditor /> : tab === "floor" ? <FloorEditor /> : <TableQrs />}
    </main>
  );
}

function MenuEditor() {
  const { data, mutate } = useApi<{ categories: MenuCategory[]; items: MenuItem[] }>("menu");
  if (!data) return <Spinner />;

  const save = async (id: string, patch: Partial<MenuItem>) => {
    mutate({ ...data, items: data.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }, false);
    await api("updateMenuItem", { id, patch }).catch((e) => alert(e.message));
    mutate();
  };

  return (
    <div className="mt-4 grid gap-5">
      {data.categories.map((c) => (
        <section key={c.id}>
          <h2 className="font-display text-lg text-brand-deep mb-2">
            {c.emoji} {c.name}
          </h2>
          <div className="card divide-y divide-line">
            {data.items
              .filter((i) => i.category_id === c.id)
              .map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-3 p-3">
                  <FoodArt item={i} className="h-12 w-12 rounded-xl" />
                  <input
                    className="flex-1 min-w-40 bg-transparent font-medium rounded-lg px-2 py-1 hover:bg-sand focus:bg-paper focus:outline-brand"
                    defaultValue={i.name}
                    onBlur={(e) => e.target.value !== i.name && save(i.id, { name: e.target.value })}
                  />
                  <span className={`chip ${i.station === "somtam" ? "bg-brand-soft text-brand-deep" : "bg-peach-soft text-red"}`}>
                    {i.station === "somtam" ? "ครัวส้มตำ" : "คาเฟ่"}
                  </span>
                  <label className="flex items-center gap-1">
                    ฿
                    <input
                      type="number"
                      min={0}
                      className="w-20 rounded-lg border border-line bg-paper px-2 py-1 text-right tabular-nums"
                      defaultValue={i.price}
                      onBlur={(e) => Number(e.target.value) !== Number(i.price) && save(i.id, { price: Number(e.target.value) })}
                    />
                  </label>
                  <button
                    title="เมนูเด็ด"
                    onClick={() => save(i.id, { is_signature: !i.is_signature })}
                    className={`chip py-1 ${i.is_signature ? "bg-sun text-brand-deep" : "bg-sand text-muted"}`}
                  >
                    ✦ เด็ด
                  </button>
                  <button
                    onClick={() => save(i.id, { is_available: !i.is_available })}
                    className={`chip py-1 w-16 justify-center ${i.is_available ? "bg-brand text-white" : "bg-line text-muted"}`}
                  >
                    {i.is_available ? "มีขาย" : "หมด"}
                  </button>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function qrTarget(path: string) {
  // With LINE configured, QRs open inside LINE: liff.line.me/<id>/<path after /liff>
  return LIFF_ID ? `https://liff.line.me/${LIFF_ID}${path.replace(/^\/liff/, "")}` : `${window.location.origin}${path}`;
}

function TableQrs() {
  const { data } = useApi<(Table & { path: string })[]>("tableQrs");
  const [imgs, setImgs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    Promise.all(
      data.map(async (t) => [t.id, await QRCode.toDataURL(qrTarget(t.path), { margin: 1, width: 400, color: { dark: "#9e140d", light: "#ffffff" } })] as const),
    ).then((pairs) => setImgs(Object.fromEntries(pairs)));
  }, [data]);

  if (!data) return <Spinner />;
  return (
    <section className="mt-4">
      <div className="no-print flex items-center justify-between mb-3">
        <p className="text-sm text-muted">พิมพ์แล้ววางบนโต๊ะ · ลูกค้าสแกนเพื่อสั่งอาหารเข้าบิลโต๊ะนั้น</p>
        <button className="btn btn-primary py-2 text-sm" onClick={() => window.print()}>
          🖨 พิมพ์ทั้งหมด
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3">
        {data.map((t) => (
          <div key={t.id} className="arch pattern-bg p-2 break-inside-avoid border-2 border-sun">
            <div className="arch bg-paper px-4 pt-6 pb-4 text-center">
              <div className="flex justify-center"><Emblem size={36} /></div>
              <div className="font-display text-brand-deep mt-1">อูเล้งคาเฟ่</div>
              <div className="font-display text-4xl text-brand mt-1">{t.code}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {imgs[t.id] ? <img src={imgs[t.id]} alt={`QR โต๊ะ ${t.code}`} className="mx-auto mt-2 w-36" /> : <div className="mx-auto mt-2 h-36 w-36" />}
              <div className="mt-2 text-xs text-muted">สแกนด้วย LINE เพื่อสั่งอาหาร</div>
              <a href={t.path} target="_blank" rel="noreferrer" className="no-print mt-1 block text-[11px] text-brand underline">
                ทดลองเปิด
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
