"use client";

import { FLOOR_COLS, FLOOR_ROWS } from "@/lib/logic";
import type { DecorKind, FloorDecor, Table } from "@/lib/types";

// Floor plan drawn with absolutely-positioned boxes on a FLOOR_COLS × FLOOR_ROWS grid.
// Positions are percentages, so the same plan scales from phone to tablet.

export type TableTone = "free" | "busy" | "taken" | "muted" | "selected" | "alert";

const pct = (n: number, of: number) => `${(n / of) * 100}%`;
export const boxStyle = (b: { x: number; y: number; w: number; h: number }): React.CSSProperties => ({
  left: pct(b.x, FLOOR_COLS),
  top: pct(b.y, FLOOR_ROWS),
  width: pct(b.w, FLOOR_COLS),
  height: pct(b.h, FLOOR_ROWS),
});

export const DECOR_LABEL: Record<DecorKind, string> = {
  area: "พื้นที่/โซน",
  canal: "คลอง",
  stage: "เวที",
  screen: "จอหนัง",
  counter: "เคาน์เตอร์",
  kitchen: "ครัว",
  entrance: "ทางเข้า",
};

const DECOR: Record<DecorKind, { icon: string; cls: string }> = {
  area: { icon: "", cls: "border-2 border-dashed border-line bg-transparent text-muted items-end justify-start p-1.5" },
  canal: { icon: "🌊", cls: "bg-[repeating-linear-gradient(180deg,#9fd3f0_0_6px,#bfe3f7_6px_12px)] text-[#1d5d82]" },
  stage: { icon: "🎤", cls: "bg-ink text-sun" },
  screen: { icon: "🎬", cls: "bg-ink/85 text-white" },
  counter: { icon: "🧋", cls: "bg-peach-soft text-brand-deep border border-peach" },
  kitchen: { icon: "🔥", cls: "bg-sun-soft text-sun-ink border border-sun" },
  entrance: { icon: "🚪", cls: "bg-white text-muted border border-line" },
};

export function DecorBox({
  d,
  className = "",
  children,
  divProps,
}: {
  d: FloorDecor;
  className?: string;
  children?: React.ReactNode;
  divProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const look = DECOR[d.kind];
  return (
    <div
      {...divProps}
      className={`absolute flex items-center justify-center gap-1 rounded-lg text-[10px] sm:text-xs font-semibold overflow-hidden select-none ${look.cls} ${
        d.kind === "area" ? "z-0" : "z-10"
      } ${className}`}
      style={boxStyle(d)}
    >
      {look.icon && <span>{look.icon}</span>}
      <span className={d.kind === "canal" ? "[writing-mode:vertical-rl]" : "truncate"}>{d.label}</span>
      {children}
    </div>
  );
}

const TONE: Record<TableTone, string> = {
  free: "bg-white border-brand text-brand-deep hover:bg-brand-soft",
  busy: "bg-brand-soft border-brand-light text-brand-deep",
  alert: "bg-sun border-sun-ink text-brand-deep animate-pulse",
  taken: "bg-brand border-brand-deep text-white",
  muted: "bg-sand/70 border-line text-muted",
  selected: "bg-sun border-brand-deep text-brand-deep ring-4 ring-brand/40 scale-105",
};

/** Seat dots around the table, so guests can read its size at a glance. */
function Chairs({ t }: { t: Pick<Table, "seats" | "shape" | "w" | "h"> }) {
  const n = Math.min(t.seats, 12);
  const dots: { left: string; top: string }[] = [];
  if (t.shape === "round") {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      dots.push({ left: `${50 + Math.cos(a) * 56}%`, top: `${50 + Math.sin(a) * 56}%` });
    }
  } else {
    const top = Math.ceil(n / 2);
    const bottom = n - top;
    for (let i = 0; i < top; i++) dots.push({ left: `${((i + 1) / (top + 1)) * 100}%`, top: "-9%" });
    for (let i = 0; i < bottom; i++) dots.push({ left: `${((i + 1) / (bottom + 1)) * 100}%`, top: "109%" });
  }
  return (
    <>
      {dots.map((p, i) => (
        <span key={i} className="absolute h-[18%] max-h-2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-current opacity-35" style={p} />
      ))}
    </>
  );
}

export function TableBox({
  t,
  tone,
  sub,
  badge,
  onClick,
  disabled,
  className = "",
  style,
  children,
  buttonProps,
}: {
  t: Pick<Table, "code" | "seats" | "shape" | "x" | "y" | "w" | "h">;
  tone: TableTone;
  sub?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <button
      {...buttonProps}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`โต๊ะ ${t.code} ${t.seats} ที่นั่ง${sub ? ` ${sub}` : ""}`}
      className={`absolute z-20 p-[3px] transition disabled:cursor-not-allowed ${className}`}
      style={{ ...boxStyle(t), ...style }}
    >
      <span
        className={`relative flex h-full w-full flex-col items-center justify-center border-2 leading-none shadow-sm transition ${
          t.shape === "round" ? "rounded-full" : "rounded-xl"
        } ${TONE[tone]}`}
      >
        <Chairs t={t} />
        <span className="font-display text-[11px] sm:text-sm">{t.code}</span>
        <span className="mt-0.5 text-[9px] sm:text-[11px] opacity-80">{sub ?? `${t.seats} ที่`}</span>
        {badge && <span className="absolute -right-1 -top-1">{badge}</span>}
      </span>
      {children}
    </button>
  );
}

/** Grid container; children are DecorBox / TableBox elements. */
export function FloorCanvas({
  children,
  minWidth = 520,
  innerRef,
  className = "",
  showGrid = false,
}: {
  children: React.ReactNode;
  minWidth?: number;
  innerRef?: React.Ref<HTMLDivElement>;
  className?: string;
  showGrid?: boolean;
}) {
  return (
    <div className={`overflow-x-auto no-scrollbar ${className}`}>
      <div
        ref={innerRef}
        className="relative rounded-2xl border border-line bg-[#fffdfb] touch-none"
        style={{
          minWidth,
          aspectRatio: `${FLOOR_COLS} / ${FLOOR_ROWS}`,
          backgroundImage: showGrid
            ? `linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)`
            : undefined,
          backgroundSize: showGrid ? `${100 / FLOOR_COLS}% ${100 / FLOOR_ROWS}%` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function FloorLegend({ items }: { items: { tone: TableTone; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1">
          <span className={`inline-block h-3 w-3 rounded border-2 ${TONE[i.tone]}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
