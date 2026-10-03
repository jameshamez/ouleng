import fs from "node:fs";
import path from "node:path";
import type { TableName, Tables } from "../types";
import { seedCategories, seedDecor, seedMenuItems, seedTables } from "../seed";
import type { Db, Filter } from "./index";

// Local file-backed store so the whole system runs without Supabase/Docker.
// Not for production: Vercel's filesystem is read-only and per-instance.
const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "demo.json");
export const UPLOAD_DIR = path.join(DIR, "uploads");

type Store = { [T in TableName]: Tables[T][] };

function fresh(): Store {
  return {
    menu_categories: structuredClone(seedCategories),
    menu_items: structuredClone(seedMenuItems),
    tables: structuredClone(seedTables),
    floor_decor: structuredClone(seedDecor),
    bookings: [],
    dining_sessions: [],
    orders: [],
    order_items: [],
    payments: [],
    customers: [],
  };
}

function load(): Store {
  try {
    const store: Store = { ...fresh(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
    // Demo files saved before the floor plan existed: give tables their starter positions.
    store.tables = store.tables.map((t) => (t.x === undefined ? { ...t, ...pos(t.id) } : t));
    return store;
  } catch {
    return fresh();
  }
}

function pos(id: string) {
  const s = seedTables.find((x) => x.id === id);
  return s ? { x: s.x, y: s.y, w: s.w, h: s.h, shape: s.shape, active: true } : { x: 0, y: 0, w: 2, h: 2, shape: "square" as const, active: true };
}

function matches<T>(row: T, filter: Filter<T>) {
  return Object.entries(filter).every(([k, v]) => {
    const cell = (row as Record<string, unknown>)[k];
    return Array.isArray(v) ? v.includes(cell) : cell === v;
  });
}

export function createDemoDb(): Db {
  const store = load();
  const save = () => {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(store, null, 1));
  };
  const rowsOf = <T extends TableName>(t: T) => store[t] as Tables[T][];
  const clone = <V>(v: V): V => structuredClone(v);

  return {
    async list(table, filter = {}) {
      return clone(rowsOf(table).filter((r) => matches(r, filter)));
    },
    async get(table, id) {
      const row = rowsOf(table).find((r) => (r as { id: string }).id === id);
      return row ? clone(row) : null;
    },
    async insert(table, row) {
      rowsOf(table).push(clone(row));
      save();
      return clone(row);
    },
    async update(table, id, patch) {
      const row = rowsOf(table).find((r) => (r as { id: string }).id === id);
      if (!row) throw new Error(`${table} ${id} not found`);
      Object.assign(row, patch);
      save();
      return clone(row);
    },
    async remove(table, id) {
      const rows = store[table] as { id: string }[];
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
      save();
    },
    async upload(name, bytes) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, path.basename(name)), Buffer.from(bytes));
      return path.basename(name);
    },
    async fileUrl(ref) {
      return `/api/file/${encodeURIComponent(ref)}`;
    },
  };
}
