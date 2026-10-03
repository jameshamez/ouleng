import "server-only";
import type { TableName, Tables } from "../types";
import { createDemoDb } from "./demo";
import { createSupabaseDb } from "./supabase";

/** Equality filter; an array value means "column IN (...)". */
export type Filter<T> = { [K in keyof T]?: T[K] | T[K][] };

export interface Db {
  list<T extends TableName>(table: T, filter?: Filter<Tables[T]>): Promise<Tables[T][]>;
  get<T extends TableName>(table: T, id: string): Promise<Tables[T] | null>;
  insert<T extends TableName>(table: T, row: Tables[T]): Promise<Tables[T]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<Tables[T]>;
  /** Store a private file (e.g. a payment slip) and return an opaque reference. */
  upload(name: string, bytes: ArrayBuffer, contentType: string): Promise<string>;
  /** Short-lived URL for staff to view a file stored with `upload`. */
  fileUrl(ref: string): Promise<string>;
}

export const isSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const globalForDb = globalThis as unknown as { __db?: Db };

export function db(): Db {
  globalForDb.__db ??= isSupabase ? createSupabaseDb() : createDemoDb();
  return globalForDb.__db;
}

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
