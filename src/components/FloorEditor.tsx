"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, useApi } from "@/lib/client";
import { FLOOR_COLS, FLOOR_ROWS } from "@/lib/logic";
import type { DecorKind, FloorDecor, Table } from "@/lib/types";
import { DECOR_LABEL, DecorBox, FloorCanvas, TableBox } from "./FloorPlan";
import { Spinner, Toast } from "./ui";

type Plan = { tables: Table[]; decor: FloorDecor[] };
type Sel = { kind: "table" | "decor"; id: string } | null;
type Drag = {
  kind: "table" | "decor";
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  origin: { x: number; y: number; w: number; h: number };
  moved: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const tmpId = () => `new-${Math.random().toString(36).slice(2, 9)}`;

/** Drag-and-drop floor plan editor. Changes stay local until "บันทึก". */
export function FloorEditor() {
  const { data, mutate } = useApi<Plan>("floorPlan");
  const [draft, setDraft] = useState<Plan | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  // Start from the saved plan (again after a save or discard).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- copy server plan into the editable draft
  useEffect(() => { if (data && !draft) setDraft(structuredClone(data)); }, [data, draft]);

  const dirty = Boolean(data && draft && JSON.stringify(data) !== JSON.stringify(draft));

  const patch = useCallback((kind: "table" | "decor", id: string, p: Partial<Table & FloorDecor>) => {
    setDraft((d) =>
      d &&
      (kind === "table"
        ? { ...d, tables: d.tables.map((t) => (t.id === id ? { ...t, ...p } : t)) }
        : { ...d, decor: d.decor.map((x) => (x.id === id ? { ...x, ...(p as Partial<FloorDecor>) } : x)) }),
    );
  }, []);

  // Pointer drag: translate pixel movement into whole grid cells.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const g = drag.current;
      const el = canvas.current;
      if (!g || !el) return;
      const r = el.getBoundingClientRect();
      const dx = Math.round(((e.clientX - g.startX) / r.width) * FLOOR_COLS);
      const dy = Math.round(((e.clientY - g.startY) / r.height) * FLOOR_ROWS);
      if (dx || dy) g.moved = true;
      const o = g.origin;
      if (g.mode === "move") {
        patch(g.kind, g.id, { x: clamp(o.x + dx, 0, FLOOR_COLS - o.w), y: clamp(o.y + dy, 0, FLOOR_ROWS - o.h) });
      } else {
        patch(g.kind, g.id, { w: clamp(o.w + dx, 1, FLOOR_COLS - o.x), h: clamp(o.h + dy, 1, FLOOR_ROWS - o.y) });
      }
    };
    const onUp = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [patch]);

  if (!data || !draft) return <Spinner />;

  const startDrag = (kind: "table" | "decor", item: { id: string; x: number; y: number; w: number; h: number }, mode: Drag["mode"]) =>
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setSel({ kind, id: item.id });
      drag.current = { kind, id: item.id, mode, startX: e.clientX, startY: e.clientY, origin: { x: item.x, y: item.y, w: item.w, h: item.h }, moved: false };
    };

  const handle = (kind: "table" | "decor", item: { id: string; x: number; y: number; w: number; h: number }) => (
    <span
      onPointerDown={startDrag(kind, item, "resize")}
      className="absolute -bottom-1 -right-1 z-30 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-brand shadow"
      aria-label="ปรับขนาด"
    />
  );

  const selTable = sel?.kind === "table" ? draft.tables.find((t) => t.id === sel.id) : undefined;
  const selDecor = sel?.kind === "decor" ? draft.decor.find((d) => d.id === sel.id) : undefined;

  const addTable = () => {
    const used = new Set(draft.tables.map((t) => t.code));
    let n = draft.tables.length + 1;
    while (used.has(`T${n}`)) n++;
    const t: Table = { id: tmpId(), code: `T${n}`, zone: "indoor", seats: 4, x: 10, y: 8, w: 3, h: 2, shape: "square", active: true };
    setDraft({ ...draft, tables: [...draft.tables, t] });
    setSel({ kind: "table", id: t.id });
  };
  const addDecor = (kind: DecorKind) => {
    const d: FloorDecor = { id: tmpId(), kind, label: DECOR_LABEL[kind], x: 9, y: 7, w: kind === "area" ? 6 : 4, h: kind === "area" ? 4 : 2 };
    setDraft({ ...draft, decor: [...draft.decor, d] });
    setSel({ kind: "decor", id: d.id });
  };
  const removeSel = () => {
    if (!sel) return;
    setDraft(
      sel.kind === "table"
        ? { ...draft, tables: draft.tables.filter((t) => t.id !== sel.id) }
        : { ...draft, decor: draft.decor.filter((d) => d.id !== sel.id) },
    );
    setSel(null);
  };
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const saved = await api<Plan>("saveFloorPlan", draft);
      await mutate(saved, false);
      setDraft(structuredClone(saved));
      setSel(null);
      setToast("บันทึกผังร้านแล้ว ✓");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4">
      <Toast message={toast} onDone={() => setToast(null)} />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary py-2 text-sm" onClick={addTable}>
          + เพิ่มโต๊ะ
        </button>
        <select
          className="rounded-full border border-line bg-paper px-3 py-2 text-sm"
          value=""
          onChange={(e) => e.target.value && addDecor(e.target.value as DecorKind)}
          aria-label="เพิ่มสิ่งตกแต่ง"
        >
          <option value="">+ สิ่งตกแต่ง…</option>
          {(Object.keys(DECOR_LABEL) as DecorKind[]).map((k) => (
            <option key={k} value={k}>
              {DECOR_LABEL[k]}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-ghost py-2 text-sm" disabled={!dirty || busy} onClick={() => { setDraft(structuredClone(data)); setSel(null); setErr(null); }}>
            ยกเลิกการแก้ไข
          </button>
          <button className="btn btn-sun py-2 text-sm" disabled={!dirty || busy} onClick={save}>
            {busy ? "กำลังบันทึก…" : dirty ? "บันทึกผัง" : "บันทึกแล้ว"}
          </button>
        </div>
      </div>
      {err && <p className="mt-3 rounded-xl bg-sand px-3 py-2 text-sm text-red">{err}</p>}
      <p className="mt-2 text-xs text-muted">ลากเพื่อย้าย · ลากจุดแดงมุมขวาล่างเพื่อปรับขนาด · แตะเพื่อแก้ข้อมูล</p>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <FloorCanvas innerRef={canvas} minWidth={640} showGrid>
          <div className="absolute inset-0" onPointerDown={() => setSel(null)} />
          {draft.decor.map((d) => (
            <DecorBox
              key={d.id}
              d={d}
              className={`cursor-move ${sel?.id === d.id ? "ring-2 ring-brand ring-offset-1" : ""} ${d.kind === "area" ? "hover:border-brand-light" : ""}`}
              divProps={{ onPointerDown: startDrag("decor", d, "move") }}
            >
              {sel?.id === d.id && handle("decor", d)}
            </DecorBox>
          ))}
          {draft.tables.map((t) => (
            <TableBox
              key={t.id}
              t={t}
              tone={sel?.id === t.id ? "selected" : "free"}
              className="cursor-move"
              buttonProps={{ onPointerDown: startDrag("table", t, "move") }}
            >
              {sel?.id === t.id && handle("table", t)}
            </TableBox>
          ))}
        </FloorCanvas>

        <aside className="card p-4 h-fit">
          {selTable ? (
            <div className="grid gap-3">
              <h3 className="font-display text-lg text-brand-deep">โต๊ะ {selTable.code}</h3>
              <label className="text-sm">
                รหัสโต๊ะ
                <input className="input mt-1" value={selTable.code} maxLength={6} onChange={(e) => patch("table", selTable.id, { code: e.target.value.toUpperCase() })} />
              </label>
              <label className="text-sm">
                จำนวนที่นั่ง
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="input mt-1"
                  value={selTable.seats}
                  onChange={(e) => patch("table", selTable.id, { seats: Number(e.target.value) })}
                />
              </label>
              <div className="text-sm">
                ทรง
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(["round", "square"] as const).map((sh) => (
                    <button key={sh} onClick={() => patch("table", selTable.id, { shape: sh })} className={`rounded-xl border py-2 ${selTable.shape === sh ? "border-brand bg-brand-soft font-semibold" : "border-line"}`}>
                      {sh === "round" ? "⚪ กลม" : "⬜ เหลี่ยม"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-sm">
                โซน
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(["indoor", "canal"] as const).map((z) => (
                    <button key={z} onClick={() => patch("table", selTable.id, { zone: z })} className={`rounded-xl border py-2 ${selTable.zone === z ? "border-brand bg-brand-soft font-semibold" : "border-line"}`}>
                      {z === "indoor" ? "🏮 ในร้าน" : "🌙 ริมคลอง"}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-danger mt-1" onClick={removeSel}>
                🗑 ลบโต๊ะนี้
              </button>
            </div>
          ) : selDecor ? (
            <div className="grid gap-3">
              <h3 className="font-display text-lg text-brand-deep">{DECOR_LABEL[selDecor.kind]}</h3>
              <label className="text-sm">
                ข้อความ
                <input className="input mt-1" value={selDecor.label} maxLength={30} onChange={(e) => patch("decor", selDecor.id, { label: e.target.value })} />
              </label>
              <button className="btn btn-danger mt-1" onClick={removeSel}>
                🗑 ลบชิ้นนี้
              </button>
            </div>
          ) : (
            <div className="text-sm text-muted">
              <p className="font-semibold text-ink">ผังร้าน</p>
              <p className="mt-1">{draft.tables.length} โต๊ะ · {draft.tables.reduce((s, t) => s + Number(t.seats || 0), 0)} ที่นั่ง</p>
              <p className="mt-3">แตะโต๊ะหรือสิ่งตกแต่งบนผังเพื่อแก้ไข</p>
              <p className="mt-3 text-xs">
                ลบโต๊ะที่มีลูกค้านั่งอยู่หรือมีจองล่วงหน้าไม่ได้ ระบบจะแจ้งตอนกดบันทึก · QR ของโต๊ะที่เปลี่ยนรหัสต้องพิมพ์ใหม่
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
