import fs from "node:fs";
import path from "node:path";
import type { TableName, Tables } from "../types";
import { seedCategories, seedMenuItems, seedTables } from "../seed";
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
    return { ...fresh(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return fresh();
  }
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
