"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, MenuItem, SelectedOption } from "./types";
import { unitPrice } from "./logic";

export interface CartEntry extends CartLine {
  key: string;
  name: string;
  emoji: string;
  unit: number; // display only; the server re-prices
}

interface CartApi {
  lines: CartEntry[];
  count: number;
  total: number;
  add(item: MenuItem, qty: number, options: SelectedOption[], note: string): void;
  setQty(key: string, qty: number): void;
  clear(): void;
  toPayload(): CartLine[];
}

const Ctx = createContext<CartApi | null>(null);

/** One cart per `scope` (e.g. "takeaway", "table:<session>", "booking"), kept in localStorage. */
export function CartProvider({ scope, children }: { scope: string; children: React.ReactNode }) {
  const storageKey = `ouleng:cart:${scope}`;
  const [lines, setLines] = useState<CartEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage once on mount
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch {}
  }, [lines, loaded, storageKey]);

  const add = useCallback((item: MenuItem, qty: number, options: SelectedOption[], note: string) => {
    const key = `${item.id}|${options.map((o) => `${o.group}:${o.label}`).join(",")}|${note}`;
    setLines((prev) => {
      const hit = prev.find((l) => l.key === key);
      if (hit) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
      return [
        ...prev,
        { key, menu_item_id: item.id, name: item.name, emoji: item.emoji, qty, options, note, unit: unitPrice(Number(item.price), options) },
      ];
    });
  }, []);

  const value = useMemo<CartApi>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      total: lines.reduce((s, l) => s + l.unit * l.qty, 0),
      add,
      setQty: (key, qty) =>
        setLines((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty } : l)))),
      clear: () => setLines([]),
      toPayload: () => lines.map(({ menu_item_id, qty, options, note }) => ({ menu_item_id, qty, options, note })),
    }),
    [lines, add],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
