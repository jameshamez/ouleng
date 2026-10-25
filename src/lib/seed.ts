// Starter data for อูเล้งคาเฟ่ แก้วอินทร์. The menu (names, prices, options, photos in
// public/menu/) is transcribed from the shop's printed menus for บันเทิงเริงตำ and อูเล้งคาเฟ่;
// the shop edits it afterwards in /staff/admin.
// Kept free of path aliases so scripts/seed-supabase.ts can import it via tsx.
import menu from "./menu.json";
import type { FloorDecor, MenuCategory, MenuItem, Table } from "./types";

export const seedCategories: MenuCategory[] = menu.categories;
export const seedMenuItems: MenuItem[] = menu.items as MenuItem[];

// Starter floor plan on a 24×18 grid: indoor room on the left, canal deck on the right.
// The shop rearranges it in /staff/admin → ผังร้าน.
const t = (code: string, zone: Table["zone"], seats: number, x: number, y: number, w: number, h: number, shape: Table["shape"]): Table => ({
  id: `t-${code}`, code, zone, seats, x, y, w, h, shape, active: true,
});

export const seedTables: Table[] = [
  t("A1", "indoor", 2, 1, 4, 2, 2, "round"),
  t("A2", "indoor", 2, 4, 4, 2, 2, "round"),
  t("A3", "indoor", 4, 7, 4, 3, 2, "square"),
  t("A4", "indoor", 4, 11, 4, 3, 2, "square"),
  t("A5", "indoor", 4, 1, 8, 3, 2, "square"),
  t("A6", "indoor", 4, 5, 8, 3, 2, "square"),
  t("A7", "indoor", 6, 9, 8, 4, 2, "square"),
  t("A8", "indoor", 6, 1, 12, 4, 2, "square"),
  t("C1", "canal", 2, 16, 3, 2, 2, "round"),
  t("C2", "canal", 2, 19, 3, 2, 2, "round"),
  t("C3", "canal", 4, 16, 6, 2, 2, "round"),
  t("C4", "canal", 4, 19, 6, 2, 2, "round"),
  t("C5", "canal", 4, 16, 9, 2, 2, "round"),
  t("C6", "canal", 4, 19, 9, 2, 2, "round"),
  t("C7", "canal", 8, 16, 12, 5, 2, "square"),
];

const d = (id: string, kind: FloorDecor["kind"], label: string, x: number, y: number, w: number, h: number): FloorDecor => ({
  id: `d-${id}`, kind, label, x, y, w, h,
});

export const seedDecor: FloorDecor[] = [
  d("indoor", "area", "ในร้าน", 0, 0, 15, 18),
  d("deck", "area", "ลานริมคลอง", 15, 0, 7, 18),
  d("counter", "counter", "เคาน์เตอร์คาเฟ่", 1, 1, 6, 2),
  d("kitchen", "kitchen", "ครัวส้มตำ", 8, 1, 6, 2),
  d("entrance", "entrance", "ทางเข้า", 9, 16, 4, 2),
  d("stage", "stage", "เวทีดนตรีสด", 16, 0, 5, 2),
  d("screen", "screen", "จอหนังกลางแปลง", 16, 15, 5, 2),
  d("canal", "canal", "คลอง", 22, 0, 2, 18),
];
