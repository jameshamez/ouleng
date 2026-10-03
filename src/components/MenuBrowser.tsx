"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import { useApi } from "@/lib/client";
import type { MenuCategory, MenuItem, SelectedOption } from "@/lib/types";
import { baht, ErrorBox, FoodArt, Sheet, Spinner, Stepper, Toast } from "./ui";

type Menu = { categories: MenuCategory[]; items: MenuItem[] };

/** Category-tabbed menu with item detail sheet. Adds to the surrounding CartProvider. */
export function MenuBrowser({ topOffset = 56 }: { topOffset?: number }) {
  const { data, error, mutate } = useApi<Menu>("menu", undefined, { refreshInterval: 30_000 });
  const [active, setActive] = useState<string | null>(null);
  const [picked, setPicked] = useState<MenuItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const sections = useRef<Record<string, HTMLElement | null>>({});
  const tabBar = useRef<HTMLDivElement>(null);

  const grouped = useMemo(
    () => (data?.categories ?? []).map((c) => ({ ...c, items: data!.items.filter((i) => i.category_id === c.id) })).filter((c) => c.items.length),
    [data],
  );
  const signature = useMemo(() => (data?.items ?? []).filter((i) => i.is_signature && i.is_available), [data]);

  // Highlight the tab of the section in view.
  useEffect(() => {
    if (!grouped.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id.replace("cat-", ""));
      },
      { rootMargin: `-${topOffset + 60}px 0px -60% 0px` },
    );
    Object.values(sections.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [grouped, topOffset]);

  useEffect(() => {
    tabBar.current?.querySelector(`[data-cat="${active}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  const jump = (id: string) => {
    const el = sections.current[id];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - topOffset - 52, behavior: "smooth" });
  };
  const onAdded = useCallback((name: string) => setToast(`เพิ่ม ${name} แล้ว`), []);

  if (error) return <div className="p-4"><ErrorBox message={error.message} onRetry={() => mutate()} /></div>;
  if (!data) return <Spinner label="กำลังเปิดเมนู…" />;

  return (
    <div>
      <Toast message={toast} onDone={() => setToast(null)} />

      {signature.length > 0 && (
        <section className="pt-4">
          <h2 className="px-4 font-display text-brand-deep mb-2">✦ เมนูเด็ดของร้าน</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-2 snap-x scroll-px-4">
            {signature.map((i) => (
              <button key={i.id} onClick={() => setPicked(i)} className="snap-start shrink-0 w-36 text-left">
                <FoodArt item={i} className="arch h-40 w-36 border-2 border-sun/40" />
                <div className="mt-2 text-sm font-semibold leading-snug line-clamp-2">{i.name}</div>
                <div className="text-sm text-brand font-semibold">{baht(i.price)}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <div ref={tabBar} className="sticky z-20 bg-cream/95 backdrop-blur border-b border-line" style={{ top: topOffset }}>
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-2.5">
          {grouped.map((c) => (
            <button
              key={c.id}
              data-cat={c.id}
              onClick={() => jump(c.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                active === c.id ? "bg-brand text-white shadow" : "bg-paper border border-line text-ink"
              }`}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>

      {grouped.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} ref={(el) => { sections.current[c.id] = el; }} className="px-4 pt-5">
          <h3 className="font-display text-xl text-brand-deep flex items-center gap-2">
            <span>{c.emoji}</span> {c.name}
            <span className="ml-1 h-px flex-1 bg-gradient-to-r from-sun/60 to-transparent" />
          </h3>
          <div className="mt-3 grid gap-3">
            {c.items.map((i) => (
              <ItemRow key={i.id} item={i} onOpen={() => setPicked(i)} />
            ))}
          </div>
        </section>
      ))}
      <div className="h-32" />

      <ItemSheet item={picked} onClose={() => setPicked(null)} onAdded={onAdded} />
    </div>
  );
}

function ItemRow({ item, onOpen }: { item: MenuItem; onOpen: () => void }) {
  const soldOut = !item.is_available;
  return (
    <button onClick={onOpen} disabled={soldOut} className="card flex gap-3 p-2.5 text-left disabled:opacity-55 active:scale-[0.99] transition">
      <FoodArt item={item} className="h-24 w-24 shrink-0 rounded-2xl" />
      <div className="flex-1 min-w-0 py-1 pr-1 flex flex-col">
        <div className="flex items-start gap-1.5">
          <span className="font-semibold leading-snug">{item.name}</span>
          {item.is_signature && <span className="chip bg-sun-soft text-sun-ink shrink-0 mt-0.5">เด็ด</span>}
        </div>
        {item.description && <p className="text-xs text-muted mt-0.5 line-clamp-2">{item.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="font-semibold text-brand">{baht(item.price)}</span>
          {soldOut ? (
            <span className="chip bg-line text-muted">หมดแล้ว</span>
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-white text-lg shadow">+</span>
          )}
        </div>
      </div>
    </button>
  );
}

function ItemSheet({ item, onClose, onAdded }: { item: MenuItem | null; onClose: () => void; onAdded: (name: string) => void }) {
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const [chosen, setChosen] = useState<SelectedOption[]>([]);
  const [note, setNote] = useState("");

  // Reset selections whenever a different item opens; preselect the first choice of required single groups.
  const [lastId, setLastId] = useState<string | null>(null);
  if (item && item.id !== lastId) {
    setLastId(item.id);
    setQty(1);
    setNote("");
    setChosen(
      item.options
        .filter((g) => g.required && !g.multi)
        .map((g) => {
          const def = g.choices.find((c) => /ปกติ|กลาง|เย็น|นึ่ง/.test(c.label)) ?? g.choices[0];
          return { group: g.name, label: def.label, price: def.price };
        }),
    );
  }
  if (!item) return null;

  const toggle = (group: string, multi: boolean, label: string, price: number) =>
    setChosen((prev) => {
      const has = prev.some((c) => c.group === group && c.label === label);
      if (multi) return has ? prev.filter((c) => !(c.group === group && c.label === label)) : [...prev, { group, label, price }];
      return [...prev.filter((c) => c.group !== group), { group, label, price }];
    });

  const unit = Number(item.price) + chosen.reduce((s, c) => s + c.price, 0);
  const missing = item.options.find((g) => g.required && !chosen.some((c) => c.group === g.name));

  return (
    <Sheet open onClose={onClose}>
      <div className="px-5 pb-5">
        <FoodArt item={item} className="arch mx-auto mt-1 h-44 w-44 border-4 border-sun-soft" />
        <h2 className="font-display text-2xl text-brand-deep text-center mt-3">{item.name}</h2>
        {item.description && <p className="text-center text-sm text-muted mt-1">{item.description}</p>}
        <p className="text-center text-lg font-semibold text-brand mt-1">{baht(item.price)}</p>

        {item.options.map((g) => (
          <div key={g.name} className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">{g.name}</span>
              <span className="text-xs text-muted">{g.required ? "ต้องเลือก" : g.multi ? "เลือกได้หลายอย่าง" : "ไม่บังคับ"}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {g.choices.map((c) => {
                const on = chosen.some((x) => x.group === g.name && x.label === c.label);
                return (
                  <button
                    key={c.label}
                    onClick={() => toggle(g.name, g.multi, c.label, c.price)}
                    className={`rounded-full border px-3.5 py-2 text-sm transition ${
                      on ? "border-brand bg-brand-soft text-brand-deep font-semibold" : "border-line bg-paper"
                    }`}
                  >
                    {c.label}
                    {c.price > 0 && <span className="text-muted"> +{c.price}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <label className="block mt-5">
          <span className="font-semibold">หมายเหตุถึงร้าน</span>
          <input className="input mt-2" placeholder="เช่น ไม่ใส่ผักชี, แยกน้ำจิ้ม" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
        </label>

        <div className="mt-6 flex items-center gap-3">
          <Stepper value={qty} onChange={setQty} min={1} />
          <button
            className="btn btn-primary flex-1"
            disabled={Boolean(missing)}
            onClick={() => {
              cart.add(item, qty, chosen, note.trim());
              onAdded(item.name);
              onClose();
            }}
          >
            ใส่ตะกร้า · {baht(unit * qty)}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** Floating bar showing the cart total; tapping opens the review sheet. */
export function CartBar({ label = "ดูตะกร้า", onOpen }: { label?: string; onOpen: () => void }) {
  const cart = useCart();
  if (cart.count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none">
      <button onClick={onOpen} className="pointer-events-auto mx-auto flex w-full max-w-md items-center gap-3 rounded-full bg-brand px-5 py-3.5 text-white shadow-xl animate-pop">
        <span className="grid h-7 min-w-7 place-items-center rounded-full bg-sun px-1.5 text-sm font-bold">{cart.count}</span>
        <span className="flex-1 text-left font-semibold">{label}</span>
        <span className="font-semibold">{baht(cart.total)}</span>
      </button>
    </div>
  );
}

/** Cart review list with quantity steppers. */
export function CartLines() {
  const cart = useCart();
  return (
    <ul className="divide-y divide-line">
      {cart.lines.map((l) => (
        <li key={l.key} className="flex items-center gap-3 py-3">
          <span className="text-2xl">{l.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium leading-snug">{l.name}</div>
            {(l.options.length > 0 || l.note) && (
              <div className="text-xs text-muted truncate">{[...l.options.map((o) => o.label), l.note].filter(Boolean).join(" · ")}</div>
            )}
            <div className="text-sm text-brand font-semibold">{baht(l.unit * l.qty)}</div>
          </div>
          <Stepper value={l.qty} onChange={(n) => cart.setQty(l.key, n)} />
        </li>
      ))}
    </ul>
  );
}
